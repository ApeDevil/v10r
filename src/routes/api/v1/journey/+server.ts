/**
 * SPA navigation beacon. Receives batched journey events fired client-side
 * from `navigator.sendBeacon` on `pagehide` (and `fetch keepalive` fallback).
 *
 * - No CSRF token (sendBeacon cannot set headers); Origin check instead.
 * - Consent-gated: requires `event.locals.consentTier === 'analytics' | 'full'`.
 * - Idempotent on `event_id` (UUID v4 from the client).
 *
 * Always responds 204 No Content (or an error status with no body) — beacon
 * callers ignore the response anyway, and silent responses prevent state echo.
 */
import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { hashVisitorId } from '$lib/server/analytics/consent';
import { recordEvent } from '$lib/server/db/analytics/mutations';
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

export const POST: RequestHandler = async ({ request, cookies, getClientAddress, locals, url }) => {
	// Origin check — same-origin only.
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) {
		return new Response(null, { status: 403 });
	}

	// Consent gate — silent reject if no analytics consent.
	if (locals.consentTier !== 'analytics' && locals.consentTier !== 'full') {
		return new Response(null, { status: 204 });
	}

	const sessionId = cookies.get('_v10r_sid');
	if (!sessionId) {
		// Tracking session expired or never started — ignore.
		return new Response(null, { status: 204 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
	}

	const parsed = v.safeParse(JourneyBatch, body);
	if (!parsed.success) {
		return json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
	}

	const ip = getClientAddress();
	const ua = request.headers.get('user-agent') ?? '';
	const visitorId = await hashVisitorId(`${ip}:${ua}`);

	// Strip referrer to origin only (no query strings — reset tokens etc. live there).
	const events = parsed.output.events.map((evt) => {
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

	// Fire-and-forget per event — idempotent on eventId.
	await Promise.all(events.map((evt) => recordEvent(evt).catch(() => {})));

	return new Response(null, { status: 204 });
};
