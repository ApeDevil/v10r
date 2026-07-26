/**
 * Workers showcase — live state for the queue-worker section.
 *
 * The platform badge is the lesson: the same claim-based worker code is dormant on
 * Vercel (no process survives the response) and running in a persistent container.
 */
import { sql } from 'drizzle-orm';
import {
	DEFAULT_DELIVERY_INTERVAL_MS,
	DELIVERY_BATCH_SIZE,
	DELIVERY_CLAIM_LEASE_MS,
	DELIVERY_MAX_ATTEMPTS,
	DELIVERY_RETRY_BASE_MS,
	DELIVERY_RETRY_FACTOR,
} from '$lib/server/config';
import { db } from '$lib/server/db';
import { notificationDeliveries } from '$lib/server/db/schema/notifications/deliveries';
import { platform } from '$lib/server/platform';
import { highlight } from '$lib/server/shiki';
import type { PageServerLoad } from './$types';

/** The claim, verbatim from outbox.ts — the page must never show a paraphrase. */
const CLAIM_SQL = `UPDATE notifications.notification_deliveries AS d
SET status = 'processing',
    attempts = d.attempts + 1,
    attempted_at = now()
FROM (
    SELECT id
    FROM notifications.notification_deliveries
    WHERE status = 'pending'
      AND next_attempt_at <= now()
    ORDER BY next_attempt_at, created_at
    LIMIT $1
    FOR UPDATE SKIP LOCKED
) AS c
WHERE d.id = c.id
RETURNING d.id, d.channel, d.attempts;`;

export const load: PageServerLoad = async () => {
	const rows = await db
		.select({ status: notificationDeliveries.status, count: sql<number>`count(*)::int` })
		.from(notificationDeliveries)
		.groupBy(notificationDeliveries.status);

	const queue = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));

	return {
		title: 'Workers - Showcases',
		platform: {
			id: platform.id,
			persistent: platform.persistent,
		},
		queue: {
			pending: queue.pending ?? 0,
			processing: queue.processing ?? 0,
			sent: queue.sent ?? 0,
			failed: queue.failed ?? 0,
			dead: queue.dead ?? 0,
		},
		policy: {
			intervalMs: DEFAULT_DELIVERY_INTERVAL_MS,
			batchSize: DELIVERY_BATCH_SIZE,
			maxAttempts: DELIVERY_MAX_ATTEMPTS,
			leaseMs: DELIVERY_CLAIM_LEASE_MS,
			retryBaseMs: DELIVERY_RETRY_BASE_MS,
			retryFactor: DELIVERY_RETRY_FACTOR,
		},
		claimSql: await highlight(CLAIM_SQL, 'sql'),
	};
};
