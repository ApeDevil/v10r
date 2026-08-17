import type { Handle } from '@sveltejs/kit';
import { waitUntil } from '@vercel/functions';
import { building, dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import {
	isAgentSurface,
	isBot,
	isBotTrackablePath,
	isBrowserNavigation,
	isExcludedPath,
	isPrefetch,
	isUserLanePath,
} from '$lib/analytics/collect-policy';
import { normalizeIpKey } from '$lib/server/abuse';
import { createLimiter } from '$lib/server/api/rate-limit';
import { ANALYTICS_CONSENT_COOKIE, ANALYTICS_SESSION_COOKIE, ANALYTICS_SESSION_TIMEOUT_MS } from '$lib/server/config';
import { recordBotHit } from '$lib/server/db/analytics/bot-mutations';
import { recordEvent, upsertSession } from '$lib/server/db/analytics/mutations';
import { recordUserEvent } from '$lib/server/db/analytics/user-mutations';
import { classifyBot } from './bot-classify';
import { type ConsentTier, deriveCookielessSessionId, hasConsent, parseConsentTier } from './consent';
import { classifyUserAgent, geoFromHeaders } from './enrich';
import { templateRoute } from './event-schema';
import { deriveVisitorId } from './visitor';

/**
 * Per-IP ceiling on anonymous pageview writes.
 *
 * Sized well above real browsing (a fast reader on a shared NAT is nowhere near
 * 120 pageviews a minute) and far below what a script can produce. Bucketed by
 * /64 at the call site — an IPv6 client rotating inside its own allocation would
 * otherwise get a fresh bucket per request and this would be decorative.
 *
 * The asymmetry this fixes: the LOWER-volume `api/analytics/journey/collect`
 * beacon has had a limiter all along, while the higher-volume entry point into
 * the same two tables had none.
 */
const pageviewLimiter = createLimiter('rl:analytics:pageview', 120, '1 m', { onError: 'open' });

/** Matches the bound enforced at the write chokepoint (db/analytics/mutations.ts). */
const MAX_TRACKED_PATH_CHARS = 512;

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
	// There is ONE database for every environment (NEON_DATABASE_URL_PROD, by
	// construction — see db/index.ts), so an ungated dev server writes localhost
	// browsing into production analytics. All three lanes refuse in dev unless
	// the override is set, which exists solely for working on the analytics
	// showcase itself. Read per-request, not at module load, so tests can flip it.
	const devMuted = dev && env.ANALYTICS_DEV_TRACKING !== 'true';
	const shouldTrack =
		!building &&
		!devMuted &&
		event.request.method === 'GET' &&
		!isExcludedPath(path) &&
		// No real route is this long. Dropping here as well as truncating at the
		// write chokepoint is deliberate: the chokepoint keeps the invariant true
		// for every future caller, this keeps an absurd URL from being carried
		// through the request at all.
		path.length <= MAX_TRACKED_PATH_CHARS &&
		!isPrefetch(event.request.headers) &&
		!isBot(event.request.headers.get('user-agent') ?? '') &&
		// A prefilter, not a bot defense: it removes subresources, prefetches and
		// naive HTTP clients, while header-copying crawlers pass it freely (see
		// isBrowserNavigation). What it admits is only ever the UNCONFIRMED lane —
		// the trustworthy count is sessions the confirm ping corroborated.
		isBrowserNavigation(event.request.headers);

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

	//
	// The complement of the human lane, and the reason it exists: everything
	// `shouldTrack` refuses for being non-human would otherwise be discarded,
	// leaving the only traffic that reads /llms.txt and the .md docs layer with no
	// evidence at all. Vercel Web Analytics cannot fill that gap — its beacon needs
	// JavaScript and crawlers run none.
	//
	// Decided pre-resolve from headers alone; nothing here touches the database or
	// the response path. Note this lane has its OWN path policy: it must admit
	// dotted paths (`/robots.txt`) and authenticated prefixes (a scanner probing
	// `/admin`) that the anonymous human lane bars for reasons that do not apply to
	// software. See isBotTrackablePath.
	const botUa = event.request.headers.get('user-agent') ?? '';
	const botLane =
		!building &&
		!devMuted &&
		event.request.method === 'GET' &&
		!isPrefetch(event.request.headers) &&
		(isBot(botUa) || !isBrowserNavigation(event.request.headers)) &&
		isBotTrackablePath(path);

	// The authenticated lane. Eligibility is decided before resolve (cheap reads
	// only); the write happens after, like the anonymous lane.
	//
	// No consent tier is consulted. For a logged-in user the ePrivacy gate does
	// not engage — the auth cookie is already strictly necessary under TDDDG
	// §25(2) Nr.2 — and processing rests on Art 6(1)(b)/(f). This is disclosed
	// under Art 13, not consented to under Art 6(1)(a).
	const userLane =
		!building &&
		!devMuted &&
		event.request.method === 'GET' &&
		isUserLanePath(path) &&
		!path.includes('.') &&
		!isPrefetch(event.request.headers) &&
		event.locals.user?.id
			? event.locals.user.id
			: null;

	const response = await resolve(event);

	// A miss writes nothing. `isExcludedPath` is a prefix/dot filter, so before
	// this every unmatched URL — every scanner probe, every typo — bought an
	// INSERT plus an UPSERT keyed on an attacker-chosen path.
	//
	// Both conditions are needed and they catch different misses. A null route id
	// means SvelteKit matched no route at all (`/wp-admin`). A 4xx with a route id
	// means a route matched but the load rejected it (`/blog/[slug]` for a slug
	// that does not exist) — invisible to the route-id check, and the more
	// interesting of the two to spam, since the path looks legitimate.
	const matchedRoute = event.route?.id != null;
	const served = response.status < 400;

	// Same miss gate as the anonymous lane below. A signed-in user hitting a dead
	// URL under /account is still a miss, and it still costs a write.
	if (userLane && matchedRoute && served) {
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

	// Recorded on EVERY status, unlike the human lanes. A 404 here is not waste —
	// a scanner probing `/wp-admin` is the row the security panel is for, and a
	// crawler 404ing on a page it expected is a sitemap problem worth seeing.
	if (botLane) {
		const identity = classifyBot(botUa);
		const route = templateRoute(event.route?.id ?? null);
		const agentSurface = isAgentSurface(path);
		waitUntil(
			recordBotHit({
				identity,
				// Used transiently for the published-range containment test and never
				// stored. Raw, not `normalizeIpKey`: that returns a /64 for IPv6.
				ip: event.locals.clientIp ?? event.getClientAddress(),
				route,
				path,
				agentSurface,
				status: response.status,
			}).catch((err) => {
				console.error('[analytics] Failed to track bot hit:', err);
			}),
		);
	}

	if (pending && matchedRoute && served) {
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
				// Rate limit INSIDE the deferred block, never in front of resolve().
				//
				// The two writes below are already off the response path, so the only
				// thing a limiter can protect here is the database — and the only thing
				// it can cost is analytics rows. Putting the Upstash round trip ahead of
				// resolve() would move a third network dependency onto TTFB to protect
				// work that is not on TTFB. Here, a Redis outage degrades collection and
				// cannot touch page rendering.
				//
				// onError: 'open' for the same reason, and it is load-bearing rather than
				// defensive. createLimiter returns the fail-closed singleton at MODULE
				// LOAD when Upstash is unconfigured in production — so with the default
				// policy a missing UPSTASH_* would silently drop 100% of analytics
				// forever, announced by one console.error at boot, inside a block whose
				// .catch swallows everything. Failing closed here protects nothing and
				// deletes the feature.
				const { success } = await pageviewLimiter.limit(`ip:${normalizeIpKey(ip) ?? ip}`);
				if (!success) return;

				const visitorId = await deriveVisitorId(ip, ua);
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
						debugOwnerId,
						clientIp: ip,
					}),
				]);
			})().catch((err) => {
				console.error('[analytics] Failed to track pageview:', err);
			}),
		);
	}

	return response;
};
