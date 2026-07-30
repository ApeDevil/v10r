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
 */
import * as v from 'valibot';
import { isBot, isExcludedPath } from '$lib/analytics/collect-policy';
import { ipLimitKey } from '$lib/server/abuse';
import { hasConsent } from '$lib/server/analytics/consent';
import { type EventName, isKnownEvent, sanitizeProperties } from '$lib/server/analytics/event-schema';
import { deriveVisitorId } from '$lib/server/analytics/visitor';
import { MAX_BEACON_BODY_BYTES, payloadTooLargeResponse, readJsonBounded } from '$lib/server/api/body';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiNoContent } from '$lib/server/api/response';
import { ANALYTICS_SESSION_COOKIE } from '$lib/server/config';
import { recordEvent } from '$lib/server/db/analytics/mutations';
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
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) {
		return apiError(403, 'forbidden', 'Cross-origin beacon rejected');
	}

	if (!hasConsent(locals.consentTier, 'analytics')) {
		return apiNoContent();
	}

	const ua = request.headers.get('user-agent') ?? '';
	if (isBot(ua)) return apiNoContent();

	const ip = locals.clientIp ?? getClientAddress();
	const { success, reset } = await limiter.limit(ipLimitKey(ip));
	if (!success) return rateLimitResponse(reset);

	const sessionId = cookies.get(ANALYTICS_SESSION_COOKIE);
	if (!sessionId) return apiNoContent();

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

	const visitorId = await deriveVisitorId(ip, ua);

	const rows = parsed.output.events
		.filter((evt) => !isExcludedPath(evt.path))
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

	if (rows.length === 0) return apiNoContent();

	await Promise.all(
		rows.map((row) =>
			recordEvent({
				eventId: row.eventId,
				sessionId,
				visitorId,
				eventType: row.eventType,
				path: row.path,
				route: row.route,
				metadata: row.metadata,
				consentTier: locals.consentTier,
				occurredAt: new Date(row.occurredAt),
			}).catch(() => {}),
		),
	);

	return apiNoContent();
};
