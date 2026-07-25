import type { Handle } from '@sveltejs/kit';
import { waitUntil } from '@vercel/functions';
import { building } from '$app/environment';
import { ANALYTICS_CONSENT_COOKIE, ANALYTICS_SESSION_COOKIE, ANALYTICS_SESSION_TIMEOUT_MS } from '$lib/server/config';
import { recordEvent, upsertSession } from '$lib/server/db/analytics/mutations';
import { recordUserEvent } from '$lib/server/db/analytics/user-mutations';
import { isBot, isExcludedPath, isPrefetch, isUserLanePath } from './collect-policy';
import { type ConsentTier, deriveCookielessSessionId, hasConsent, hashVisitorId, parseConsentTier } from './consent';
import { classifyUserAgent, geoFromHeaders } from './enrich';
import { templateRoute } from './event-schema';

interface PendingTrack {
	ip: string;
	ua: string;
	consentTier: ConsentTier;
	referrer: string | undefined;
	/** Connection-derived, so collectable at every tier (see enrich.ts). */
	country: string | undefined;
	/** UA-derived — terminal configuration, so `analytics` tier only. */
	device: string | undefined;
	browser: string | undefined;
	/** Known pre-resolve only when consent allows the cookie session; otherwise derived
	 *  from the visitor hash AFTER resolve (so the hash never sits on the TTFB path). */
	sessionId: string | null;
}

export const analyticsCollector: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	const shouldTrack =
		!building &&
		event.request.method === 'GET' &&
		!isExcludedPath(path) &&
		!isPrefetch(event.request.headers) &&
		!isBot(event.request.headers.get('user-agent') ?? '');

	// PRE-resolve: only the cookie write (which must reach the outgoing headers) and
	// cheap reads. clientIp + consentTier are reused from locals (stamped by
	// securityHeaders / consentLoader) instead of recomputed. The visitor hash and DB
	// writes are deferred to after resolve so nothing avoidable sits on the TTFB path.
	let pending: PendingTrack | null = null;
	if (shouldTrack) {
		const ip = event.locals.clientIp ?? event.getClientAddress();
		const ua = event.request.headers.get('user-agent') ?? '';
		// Reuse the tier consentLoader already parsed; fall back to the cookie so this
		// hook stays correct in isolation (unit tests) and if the chain is reordered.
		const consentTier = event.locals.consentTier ?? parseConsentTier(event.cookies.get(ANALYTICS_CONSENT_COOKIE));
		const analyticsConsent = hasConsent(consentTier, 'analytics');
		const referrer = analyticsConsent ? (event.request.headers.get('referer') ?? undefined) : undefined;

		// Country is connection-derived (edge geo header), so it is not terminal-
		// equipment access and needs no consent. Device and browser are parsed from
		// the User-Agent — that IS terminal configuration — so they wait for the
		// analytics tier. See enrich.ts for the full reasoning.
		const country = geoFromHeaders(event.request.headers);
		const { device, browser } = analyticsConsent ? classifyUserAgent(ua) : { device: undefined, browser: undefined };

		// TDDDG §25 / ePrivacy Art 5(3): the session cookie writes to terminal
		// equipment and is not strictly necessary — setting (or reading) it requires
		// at least 'analytics' consent. Without consent, fall back to a cookieless
		// daily session id derived from the visitor hash (computed after resolve).
		let sessionId: string | null = null;
		if (hasConsent(consentTier, 'analytics')) {
			const sessionCookie = event.cookies.get(ANALYTICS_SESSION_COOKIE);
			sessionId = sessionCookie ?? `s_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
			if (!sessionCookie) {
				event.cookies.set(ANALYTICS_SESSION_COOKIE, sessionId, {
					path: '/',
					httpOnly: true,
					secure: true,
					sameSite: 'lax',
					maxAge: ANALYTICS_SESSION_TIMEOUT_MS / 1000,
				});
			}
		} else if (event.cookies.get(ANALYTICS_SESSION_COOKIE)) {
			// Consent absent or withdrawn — remove a stale cookie from a prior grant.
			event.cookies.delete(ANALYTICS_SESSION_COOKIE, { path: '/' });
		}

		pending = { ip, ua, consentTier, referrer, country, device, browser, sessionId };
	}

	// The authenticated lane. Eligibility is decided before resolve (cheap reads
	// only); the write happens after, like the anonymous lane.
	//
	// No consent tier is consulted. For a logged-in user the ePrivacy gate does
	// not engage — the auth cookie is already strictly necessary under TDDDG
	// §25(2) Nr.2 — and processing rests on Art 6(1)(b)/(f). This is disclosed
	// under Art 13, not consented to under Art 6(1)(a).
	const userLane =
		!building &&
		event.request.method === 'GET' &&
		isUserLanePath(path) &&
		!path.includes('.') &&
		!isPrefetch(event.request.headers) &&
		event.locals.user?.id
			? event.locals.user.id
			: null;

	const response = await resolve(event);

	if (userLane) {
		const route = templateRoute(event.route?.id ?? null);
		waitUntil(
			recordUserEvent({
				userId: userLane,
				surface: 'account',
				eventType: 'pageview',
				route,
				path,
			}).catch((err) => {
				console.error('[analytics] Failed to track user event:', err);
			}),
		);
	}

	if (pending) {
		const { ip, ua, consentTier, referrer, country, device, browser, sessionId: preSessionId } = pending;
		const debugOwnerId = event.locals.debugOwnerId ?? null;
		// Resolved after resolve(): event.route.id is only populated once SvelteKit
		// has matched the request to a route. Optional-chained so the hook stays
		// callable with a minimal event object in unit tests.
		const route = templateRoute(event.route?.id ?? null);
		// Deferred AFTER resolve — visitor hash + DB writes, no cookie ops here.
		//
		// waitUntil() is load-bearing, not decoration: on Vercel the function may be
		// frozen the moment the response is returned, so a bare un-awaited promise
		// loses an unbounded share of pageviews. Off-Vercel (container, tests) the
		// @vercel/functions shim degrades to plain fire-and-forget, so no env guard
		// is needed. The .catch() is attached BEFORE handing the promise over, so a
		// DB failure can never surface as an unhandled rejection.
		waitUntil(
			(async () => {
				const visitorId = await hashVisitorId(`${ip}:${ua}`);
				const sessionId = preSessionId ?? (await deriveCookielessSessionId(visitorId));
				await Promise.all([
					recordEvent({
						sessionId,
						visitorId,
						eventType: 'pageview',
						path,
						route,
						referrer,
						consentTier,
						debugOwnerId,
					}),
					upsertSession({
						id: sessionId,
						visitorId,
						entryPath: path,
						exitPath: path,
						country,
						device,
						browser,
						consentTier,
						pairedAdminUserId: debugOwnerId,
					}),
				]);
			})().catch((err) => {
				console.error('[analytics] Failed to track pageview:', err);
			}),
		);
	}

	return response;
};
