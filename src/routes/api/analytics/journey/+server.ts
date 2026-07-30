/**
 * SPA navigation beacon. Receives batched journey events fired client-side
 * from `navigator.sendBeacon` on `pagehide` (and `fetch keepalive` fallback).
 *
 * - No CSRF token (sendBeacon cannot set headers); Origin check instead.
 * - Consent-gated: requires at least `analytics` consent.
 * - Idempotent on `event_id` (UUID v4 from the client).
 * - Path-filtered through the SHARED collection policy, so client-side
 *   navigations obey exactly the same exclusions as server navigations. The
 *   beacon is initialised in the root layout and therefore fires on every
 *   route — without this filter, authenticated surfaces leak into the
 *   anonymous lane.
 *
 * Advances session state (`page_count`, `exit_path`, `ended_at`) as well as
 * recording events: without it a visitor's session is frozen at whatever the
 * first server-rendered page load wrote, which silently breaks bounce rate,
 * session duration, exit pages, and the active-session count.
 */
import * as v from 'valibot';
import { isBot, isExcludedPath } from '$lib/analytics/collect-policy';
import { normalizeIpKey } from '$lib/server/abuse';
import { hasConsent } from '$lib/server/analytics/consent';
import { deriveVisitorId } from '$lib/server/analytics/visitor';
import { MAX_BEACON_BODY_BYTES, payloadTooLargeResponse, readJsonBounded } from '$lib/server/api/body';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiNoContent } from '$lib/server/api/response';
import { ANALYTICS_SESSION_COOKIE } from '$lib/server/config';
import { recordEvent, upsertSession } from '$lib/server/db/analytics/mutations';
import type { RequestHandler } from './$types';

const JourneyEvent = v.object({
	eventId: v.pipe(v.string(), v.uuid('Bad event_id')),
	path: v.pipe(v.string(), v.maxLength(512), v.regex(/^\/[^?#]*$/, 'path must be a pathname')),
	referrer: v.nullish(v.pipe(v.string(), v.maxLength(512))),
	occurredAt: v.pipe(v.string(), v.isoTimestamp()),
});

const JourneyBatch = v.object({
	events: v.pipe(v.array(JourneyEvent), v.minLength(1), v.maxLength(20)),
});

/**
 * The batch beacon had NO limiter, while its own sibling `collect` endpoint has
 * had one all along — and this one performs the heavier work of the two: an
 * INSERT per event plus a session UPSERT, up to 20 events per request.
 */
const limiter = createLimiter('rl:analytics:journey', 30, '1 m', { onError: 'open' });

export const POST: RequestHandler = async ({ request, cookies, getClientAddress, locals, url }) => {
	// Origin check — same-origin only.
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) {
		return apiError(403, 'forbidden', 'Cross-origin beacon rejected');
	}

	// Consent gate — silent accept-and-drop if consent is below `analytics`.
	if (!hasConsent(locals.consentTier, 'analytics')) {
		return apiNoContent();
	}

	const ua = request.headers.get('user-agent') ?? '';
	if (isBot(ua)) return apiNoContent();

	// `locals.clientIp` is the canonical address, stamped once by securityHeaders
	// before any handler runs; raw header-derived values are attacker-mutable
	// until then. Identical to getClientAddress() today — this keeps it that way.
	const ip = locals.clientIp ?? getClientAddress();
	const { success, reset } = await limiter.limit(`ip:${normalizeIpKey(ip) ?? ip}`);
	if (!success) return rateLimitResponse(reset);

	const sessionId = cookies.get(ANALYTICS_SESSION_COOKIE);
	if (!sessionId) {
		// Tracking session expired or never started — ignore.
		return apiNoContent();
	}

	// Unauthenticated beacon: bound the read rather than parsing whatever arrives.
	const read = await readJsonBounded(request, MAX_BEACON_BODY_BYTES);
	if (!read.ok) {
		if (read.reason === 'too_large') return payloadTooLargeResponse(MAX_BEACON_BODY_BYTES);
		return apiError(400, 'invalid_payload', 'Body is not valid JSON');
	}
	const body: unknown = read.value;

	const parsed = v.safeParse(JourneyBatch, body);
	if (!parsed.success) {
		return apiError(400, 'invalid_payload', 'Journey batch failed validation');
	}

	// Drop excluded paths BEFORE counting, so they inflate neither the event log
	// nor the session's page count.
	const tracked = parsed.output.events.filter((evt) => !isExcludedPath(evt.path));
	if (tracked.length === 0) return apiNoContent();

	const visitorId = await deriveVisitorId(ip, ua);

	// Strip referrer to origin only (no query strings — reset tokens etc. live there).
	const events = tracked.map((evt) => {
		let referrer: string | undefined;
		if (evt.referrer) {
			try {
				referrer = new URL(evt.referrer).origin;
			} catch {
				referrer = undefined;
			}
		}
		return {
			eventId: evt.eventId,
			sessionId,
			visitorId,
			eventType: 'pageview' as const,
			path: evt.path,
			referrer,
			consentTier: locals.consentTier,
			occurredAt: new Date(evt.occurredAt),
		};
	});

	// Idempotent on eventId, so a re-delivered beacon is a no-op.
	await Promise.all(events.map((evt) => recordEvent(evt).catch(() => {})));

	// Queue order is navigation order: first entry, last exit.
	await upsertSession({
		id: sessionId,
		visitorId,
		entryPath: events[0].path,
		exitPath: events[events.length - 1].path,
		pageIncrement: events.length,
		consentTier: locals.consentTier,
	}).catch(() => {});

	return apiNoContent();
};
