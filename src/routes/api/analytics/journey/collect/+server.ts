/**
 * Behavioural + performance event ingest.
 *
 * Receives batched custom events (rage clicks, scroll depth, engagement, form
 * abandonment) and Web Vitals samples from the client telemetry module, over
 * `navigator.sendBeacon` / `fetch keepalive`.
 *
 * Deliberately nested under `/api/analytics/journey/` rather than given its own
 * top-level path: that prefix is already CSRF-exempt (sendBeacon cannot set
 * headers) and already carries the Origin check, so one exemption covers both
 * ingest routes instead of widening the exempt surface.
 *
 * Everything is allowlisted. An unknown event name is dropped and an unknown
 * property key is stripped — see `analytics/event-schema.ts`. A client cannot
 * widen the schema by sending more, which is what keeps `GROUP BY` cardinality
 * bounded no matter what ends up calling this.
 *
 * Two lanes, decided per event by `collect-policy.ts` exactly as the server hook
 * decides page views: an event from a user-lane path (`/account`, `/desk`) of a
 * signed-in user is written to `analytics.user_events` under their id — no
 * consent tier, no visitor hash, no session cookie (`user-events.ts` explains
 * why the ePrivacy gate does not engage there); everything else takes the
 * anonymous lane, which refuses without consent and drops excluded paths. A
 * batch may carry both: the SPA beacon flushes across navigations.
 */
import * as v from 'valibot';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { isBot, isExcludedPath, userLaneSurface } from '$lib/analytics/collect-policy';
import { ipLimitKey } from '$lib/server/abuse';
import { SESSION_COOKIE } from '$lib/server/analytics/config';
import { hasConsent } from '$lib/server/analytics/consent';
import { type EventName, isKnownEvent, sanitizeProperties, templateRoute } from '$lib/server/analytics/event-schema';
import { deriveVisitorId } from '$lib/server/analytics/visitor';
import { confirmSession, recordEvents } from '$lib/server/db/analytics/mutations';
import { recordUserEvents } from '$lib/server/db/analytics/user-mutations';
import { MAX_BEACON_BODY_BYTES, payloadTooLargeResponse, readJsonBounded } from '$lib/server/http/body';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiNoContent } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

/** Web Vitals metrics we accept. Anything else is not a metric we chart. */
const VITALS = ['LCP', 'INP', 'CLS', 'TTFB', 'FCP'] as const;

const CollectEvent = v.object({
	eventId: v.pipe(v.string(), v.uuid()),
	kind: v.picklist(['action', 'timing', 'error']),
	/** Event name for `action`, metric name for `timing`. */
	name: v.pipe(v.string(), v.maxLength(64)),
	path: v.pipe(v.string(), v.maxLength(512), v.regex(/^\/[^?#]*$/)),
	route: v.pipe(v.string(), v.maxLength(256)),
	value: v.nullish(v.number()),
	props: v.nullish(v.record(v.string(), v.unknown())),
	occurredAt: v.pipe(v.string(), v.isoTimestamp()),
});

const CollectBatch = v.object({
	events: v.pipe(v.array(CollectEvent), v.minLength(1), v.maxLength(50)),
});

// Generous but finite: a busy session legitimately produces several batches.
const limiter = createLimiter('rl:analytics:collect', 60, '1 m');

/** One validated row, ready for `recordEvent`. */
interface CollectRow {
	eventId: string;
	path: string;
	route: string;
	occurredAt: string;
	eventType: 'action' | 'timing' | 'error';
	metadata: Record<string, string | number | boolean>;
}

export const POST: RequestHandler = async ({ request, cookies, getClientAddress, locals, url }) => {
	// Same dev gate as the server hook: one database for every environment, so
	// an ungated dev server writes localhost telemetry into production.
	if (dev && env.ANALYTICS_DEV_TRACKING !== 'true') {
		return apiNoContent();
	}

	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) {
		return apiError(403, 'forbidden', 'Cross-origin beacon rejected');
	}

	const ua = request.headers.get('user-agent') ?? '';
	if (isBot(ua)) return apiNoContent();

	const ip = locals.clientIp ?? getClientAddress();
	const { success, reset } = await limiter.limit(ipLimitKey(ip));
	if (!success) return rateLimitResponse(reset);

	// Unauthenticated beacon: bound the read rather than parsing whatever arrives.
	const read = await readJsonBounded(request, MAX_BEACON_BODY_BYTES);
	if (!read.ok) {
		if (read.reason === 'too_large') return payloadTooLargeResponse(MAX_BEACON_BODY_BYTES);
		return apiError(400, 'invalid_payload', 'Body is not valid JSON');
	}
	const body: unknown = read.value;

	const parsed = v.safeParse(CollectBatch, body);
	if (!parsed.success) {
		return apiError(400, 'invalid_payload', 'Collect batch failed validation');
	}

	const rows = parsed.output.events
		.map((evt): CollectRow | null => {
			if (evt.kind === 'timing') {
				// A performance sample. The metric name is closed, and the value is
				// rounded — sub-millisecond precision is noise, and precision is
				// fingerprinting surface.
				if (!(VITALS as readonly string[]).includes(evt.name)) return null;
				if (typeof evt.value !== 'number' || !Number.isFinite(evt.value)) return null;
				const metadata: Record<string, string | number | boolean> = {
					metric: evt.name,
					// CLS is a small unitless ratio; the rest are milliseconds.
					value: evt.name === 'CLS' ? Math.round(evt.value * 1000) / 1000 : Math.round(evt.value),
				};
				// Attribution: which element was responsible. This is what makes a
				// vitals number actionable rather than merely alarming.
				const target = evt.props?.target;
				if (typeof target === 'string' && target.length > 0) metadata.target = target.slice(0, 120);
				return { ...evt, eventType: 'timing', metadata };
			}

			if (evt.kind === 'action') {
				if (!isKnownEvent(evt.name)) return null;
				const metadata: Record<string, string | number | boolean> = {
					event: evt.name,
					...sanitizeProperties(evt.name as EventName, evt.props),
				};
				return { ...evt, eventType: 'action', metadata };
			}

			// Client error. Message only, capped — never a stack, which can carry
			// URLs, tokens, and user input from enclosing scopes.
			const message = typeof evt.props?.message === 'string' ? evt.props.message.slice(0, 200) : 'unknown';
			return { ...evt, eventType: 'error', metadata: { message } };
		})
		.filter((row): row is NonNullable<typeof row> => row !== null);

	// Lane split. A user-lane path without a signed-in user is nobody's: it is
	// excluded from the anonymous lane by the same predicate, so it drops.
	const userId = locals.user?.id ?? null;
	const userRows = userId
		? rows.flatMap((row) => {
				const surface = userLaneSurface(row.path);
				return surface ? [{ row, surface }] : [];
			})
		: [];
	const anonRows = rows.filter((row) => !isExcludedPath(row.path));

	const writes: Promise<unknown>[] = [];

	if (userId && userRows.length > 0) {
		writes.push(
			recordUserEvents(
				userRows.map(({ row, surface }) => ({
					eventId: row.eventId,
					userId,
					surface,
					eventType: row.eventType,
					route: templateRoute(row.route),
					path: row.path,
					metadata: row.metadata,
					occurredAt: new Date(row.occurredAt),
				})),
			).catch(() => {}),
		);
	}

	// The anonymous lane keeps its two gates: the consent tier, re-checked on the
	// server because the client's copy can lag a withdrawal, and the session
	// cookie the tier controls.
	const sessionId = cookies.get(SESSION_COOKIE);
	if (anonRows.length > 0 && hasConsent(locals.consentTier, 'analytics') && sessionId) {
		const visitorId = await deriveVisitorId(ip, ua);

		// A telemetry batch is JS corroboration too — redundancy for a lost confirm
		// ping. Awaited alongside the batch insert rather than fired bare: on Vercel an
		// un-awaited promise is killable the instant the 204 is returned, which silently
		// undercounted confirmed visitors on this lane. Its sibling endpoint
		// (journey/confirm) always awaited; this one now matches.
		//
		// One batched INSERT instead of one per event — with poolQueryViaFetch each
		// statement is its own HTTPS request to Neon, so a 50-event batch was 50 round
		// trips from a single invocation.
		writes.push(
			confirmSession(sessionId).catch(() => {}),
			recordEvents(
				anonRows.map((row) => ({
					eventId: row.eventId,
					sessionId,
					visitorId,
					eventType: row.eventType,
					path: row.path,
					// Templated here, not stored verbatim. The client sends SvelteKit's raw
					// `page.route.id` (`/[[locale=locale]]/(public)/docs/[...slug]`) while the
					// server hook stores `templateRoute()` output (`/docs/[...slug]`) — same
					// column, two formats, so every per-route aggregate was silently split
					// across two keys. Measured at 738 client-verbatim rows against 1005
					// templated ones. `templateRoute` is idempotent, so applying it here is
					// safe whichever format arrives.
					route: templateRoute(row.route),
					metadata: row.metadata,
					consentTier: locals.consentTier,
					debugOwnerId: locals.debugOwnerId ?? null,
					occurredAt: new Date(row.occurredAt),
				})),
			).catch(() => {}),
		);
	}

	await Promise.all(writes);

	return apiNoContent();
};
