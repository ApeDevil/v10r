/**
 * Notification outbox — a claim-based queue over notifications.notification_deliveries.
 *
 * The drain is a real queue worker, not a poller: rows are taken with an atomic
 * claim (FOR UPDATE SKIP LOCKED), terminal writes are fenced on the claim, and a
 * lapsed claim is reclaimed by reclaimStaleDeliveries(). See
 * docs/blueprint/architecture/workers.md.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DELIVERY_CLAIM_LEASE_MS, DELIVERY_MAX_ATTEMPTS } from '$lib/server/config';
import { db } from '$lib/server/db';
import { rowsOf } from '$lib/server/db/rows';
import { notificationDeliveries } from '$lib/server/db/schema/notifications/deliveries';
import type { NotificationParams } from '$lib/server/db/schema/notifications/notifications';
import { backoffMs, decideFailure, type FailureDecision } from './backoff';

// 'push' exists in the enum/union for admin/health parity, but v1 never writes
// push outbox rows — push delivers synchronously in NotificationService.
type Channel = 'email' | 'telegram' | 'discord' | 'push';

/** A delivery taken by this worker, joined with the fields needed to render it. */
export interface ClaimedDelivery {
	id: string;
	notificationId: string;
	channel: Channel;
	/**
	 * Post-increment attempt number. Doubles as the FENCE TOKEN: markSent/markFailed
	 * guard on it, so a zombie worker whose claim was reaped — and whose row was then
	 * re-claimed, bumping attempts — can no longer overwrite the row.
	 */
	attempts: number;
	userId: string;
	messageKey: string;
	messageParams: NotificationParams;
}

/** Reference to a claim, sufficient to guard a terminal write. */
export interface DeliveryClaimRef {
	id: string;
	attempts: number;
}

/** Create delivery records for a notification's target channels */
export async function createDeliveries(notificationId: string, channels: Channel[]) {
	if (channels.length === 0) return [];

	return db
		.insert(notificationDeliveries)
		.values(
			channels.map((channel) => ({
				id: crypto.randomUUID(),
				notificationId,
				channel,
			})),
		)
		.returning();
}

/**
 * Atomically claim up to `batchSize` due deliveries.
 *
 * ONE statement, deliberately: `poolQueryViaFetch` only redirects single stateless
 * Pool.query() calls to HTTP — db.transaction() takes the WebSocket path that Bun
 * mishandles (see the comment in $lib/server/db/index.ts). Same reasoning as
 * $lib/server/mcp/demo/service.ts. A single statement is its own transaction, so the
 * row locks taken by the subquery are held for the statement and released at commit,
 * which is exactly the window the UPDATE needs.
 *
 * SKIP LOCKED means a concurrent claimer never blocks; it also means a claimer may
 * return FEWER than batchSize rows under contention (LIMIT applies before skipping).
 * That is expected and harmless.
 *
 * Raw SQL rather than the query builder on purpose: the lock clause must be literal
 * and reviewable. PGlite is single-connection, so a silently-dropped SKIP LOCKED
 * could never be caught by a test — see outbox.test.ts.
 *
 * The join to notifications is safe and saves a per-row SELECT: notification_id is
 * NOT NULL with an ON DELETE CASCADE FK, so a delivery cannot outlive its notification.
 */
export async function claimDeliveries(batchSize: number): Promise<ClaimedDelivery[]> {
	if (batchSize <= 0) return [];

	const result = await db.execute(sql`
		UPDATE notifications.notification_deliveries AS d
		SET status = 'processing',
		    attempts = d.attempts + 1,
		    attempted_at = now()
		FROM (
			SELECT id
			FROM notifications.notification_deliveries
			WHERE status = 'pending'
			  AND next_attempt_at <= now()
			ORDER BY next_attempt_at, created_at
			LIMIT ${batchSize}
			FOR UPDATE SKIP LOCKED
		) AS c,
		notifications.notifications AS n
		WHERE d.id = c.id
		  AND n.id = d.notification_id
		RETURNING
			d.id              AS "id",
			d.notification_id AS "notificationId",
			d.channel::text   AS "channel",
			d.attempts        AS "attempts",
			n.user_id         AS "userId",
			n.message_key     AS "messageKey",
			n.message_params  AS "messageParams"
	`);

	// The double quotes on every alias above are load-bearing: unquoted `AS
	// notificationId` is folded to `notificationid` by Postgres, which still
	// type-checks here and yields `undefined` at runtime on every claimed row.
	return rowsOf<{
		id: string;
		notificationId: string;
		channel: string;
		attempts: number | string;
		userId: string;
		messageKey: string;
		messageParams: NotificationParams | null;
	}>(result).map((r) => ({
		id: r.id,
		notificationId: r.notificationId,
		channel: r.channel as Channel,
		// int4 arrives as a number on both drivers, but this is the fence token —
		// a stringy '2' would bind as text and silently never match the guard.
		attempts: Number(r.attempts),
		userId: r.userId,
		messageKey: r.messageKey,
		messageParams: r.messageParams ?? {},
	}));
}

/**
 * Statuses a fenced terminal write may act on.
 *
 * 'pending' is included alongside 'processing' on purpose: if the reaper requeued
 * the row and the original worker THEN reports back, its report still carries the
 * better information and should land. The fence token is what keeps this safe —
 * a re-claim bumps attempts, so only the worker that still owns the row matches.
 */
const FENCEABLE = ['processing', 'pending'] as const;

/** Record a successful send. Returns false if the claim was lost. */
export async function markSent(claim: DeliveryClaimRef, providerMessageId?: string): Promise<boolean> {
	const [row] = await db
		.update(notificationDeliveries)
		.set({
			status: 'sent',
			providerMessageId: providerMessageId ?? null,
			sentAt: new Date(),
			// A row that failed and then succeeded must not keep showing the old error.
			errorCode: null,
			errorMessage: null,
		})
		.where(
			and(
				eq(notificationDeliveries.id, claim.id),
				eq(notificationDeliveries.attempts, claim.attempts),
				inArray(notificationDeliveries.status, [...FENCEABLE]),
			),
		)
		.returning({ id: notificationDeliveries.id });

	return Boolean(row);
}

/**
 * Record a terminal or retryable failure for a claimed delivery.
 *
 * Returns the decision that was applied, or null if the claim was lost.
 */
export async function markFailed(
	claim: DeliveryClaimRef,
	errorCode: string,
	errorMessage: string,
	retryable: boolean,
): Promise<FailureDecision | null> {
	const decision = decideFailure({ attempts: claim.attempts, retryable });

	// now() is the DATABASE clock — the same clock the claim's `next_attempt_at <=
	// now()` reads. Only the delay itself comes from the pure policy module.
	const patch =
		decision.status === 'pending'
			? {
					status: 'pending' as const,
					errorCode,
					errorMessage,
					nextAttemptAt: sql`now() + make_interval(secs => ${decision.delayMs / 1000})`,
				}
			: { status: decision.status, errorCode, errorMessage };

	const [row] = await db
		.update(notificationDeliveries)
		.set(patch)
		.where(
			and(
				eq(notificationDeliveries.id, claim.id),
				eq(notificationDeliveries.attempts, claim.attempts),
				inArray(notificationDeliveries.status, [...FENCEABLE]),
			),
		)
		.returning({ id: notificationDeliveries.id });

	return row ? decision : null;
}

/**
 * Reclaim deliveries whose worker lease lapsed.
 *
 * A row sits in 'processing' only between claimDeliveries() and markSent/markFailed.
 * If the process died in between — SIGKILL, Vercel maxDuration, unhandled throw —
 * nothing else will ever move it. `attempted_at` is stamped at claim and never
 * touched afterwards, so `attempted_at < now() - lease` is precisely "claimed and
 * never reported back". (COALESCE to created_at defends against any legacy row.)
 *
 * Does NOT bump attempts — the attempt was already counted at claim time. Because a
 * RE-claim bumps it, the zombie's late markSent/markFailed can no longer match its
 * fence, and a repeatedly-reaped row still converges on 'dead' rather than looping.
 *
 * Flat reclaim delay rather than per-row exponential: a lapsed lease means the
 * WORKER died, not that the provider rejected us, and one constant keeps the backoff
 * curve implemented in exactly one place.
 *
 * Called from notificationDelivery() inside the drain guard, so a process can never
 * reap the batch it is itself working on.
 */
export async function reclaimStaleDeliveries(): Promise<number> {
	const leaseSecs = DELIVERY_CLAIM_LEASE_MS / 1000;
	const reclaimSecs = backoffMs(1) / 1000;

	const rows = await db
		.update(notificationDeliveries)
		.set({
			// Explicit enum casts: two bare literals in a CASE resolve to `text`, and
			// Postgres has no assignment cast from text to an enum column.
			status: sql`CASE WHEN ${notificationDeliveries.attempts} >= ${DELIVERY_MAX_ATTEMPTS}
				THEN 'dead'::notifications.delivery_status
				ELSE 'pending'::notifications.delivery_status END`,
			errorCode: 'CLAIM_EXPIRED',
			errorMessage: 'Worker lease expired before the delivery reported an outcome.',
			nextAttemptAt: sql`now() + make_interval(secs => ${reclaimSecs})`,
		})
		.where(
			sql`${notificationDeliveries.status} = 'processing'
			    AND coalesce(${notificationDeliveries.attemptedAt}, ${notificationDeliveries.createdAt})
			        < now() - make_interval(secs => ${leaseSecs})`,
		)
		.returning({ id: notificationDeliveries.id });

	return rows.length;
}
