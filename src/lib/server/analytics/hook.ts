import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { ANALYTICS_CONSENT_COOKIE, ANALYTICS_SESSION_TIMEOUT_MS } from '$lib/server/config';
import { recordEvent, upsertSession } from '$lib/server/db/analytics/mutations';
import { type ConsentTier, deriveCookielessSessionId, hasConsent, hashVisitorId, parseConsentTier } from './consent';

const BOT_UA_RE =
	/bot|crawler|spider|slurp|baiduspider|facebookexternalhit|whatsapp|twitterbot|linkedinbot|googlebot|bingbot|yandexbot|duckduckbot|applebot|prerender|headless|lighthouse/i;

interface PendingTrack {
	ip: string;
	ua: string;
	consentTier: ConsentTier;
	referrer: string | undefined;
	/** Known pre-resolve only when consent allows the cookie session; otherwise derived
	 *  from the visitor hash AFTER resolve (so the hash never sits on the TTFB path). */
	sessionId: string | null;
}

export const analyticsCollector: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	const shouldTrack =
		!building &&
		event.request.method === 'GET' &&
		!path.startsWith('/api/') &&
		!path.startsWith('/_app/') &&
		!path.startsWith('/admin') &&
		!path.startsWith('/app') &&
		!path.includes('.') &&
		event.request.headers.get('sec-purpose') !== 'prefetch' &&
		event.request.headers.get('purpose') !== 'prefetch' &&
		event.request.headers.get('x-sveltekit-prefetch') === null &&
		!BOT_UA_RE.test(event.request.headers.get('user-agent') ?? '');

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
		const referrer = hasConsent(consentTier, 'analytics')
			? (event.request.headers.get('referer') ?? undefined)
			: undefined;

		// TDDDG §25 / ePrivacy Art 5(3): the session cookie writes to terminal
		// equipment and is not strictly necessary — setting (or reading) it requires
		// at least 'analytics' consent. Without consent, fall back to a cookieless
		// daily session id derived from the visitor hash (computed after resolve).
		let sessionId: string | null = null;
		if (hasConsent(consentTier, 'analytics')) {
			const sessionCookie = event.cookies.get('_v10r_sid');
			sessionId = sessionCookie ?? `s_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
			if (!sessionCookie) {
				event.cookies.set('_v10r_sid', sessionId, {
					path: '/',
					httpOnly: true,
					secure: true,
					sameSite: 'lax',
					maxAge: ANALYTICS_SESSION_TIMEOUT_MS / 1000,
				});
			}
		} else if (event.cookies.get('_v10r_sid')) {
			// Consent absent or withdrawn — remove a stale cookie from a prior grant.
			event.cookies.delete('_v10r_sid', { path: '/' });
		}

		pending = { ip, ua, consentTier, referrer, sessionId };
	}

	const response = await resolve(event);

	if (pending) {
		const { ip, ua, consentTier, referrer, sessionId: preSessionId } = pending;
		const debugOwnerId = event.locals.debugOwnerId ?? null;
		// Fire-and-forget AFTER resolve — visitor hash + DB writes, no cookie ops here.
		Promise.resolve()
			.then(async () => {
				const visitorId = await hashVisitorId(`${ip}:${ua}`);
				const sessionId = preSessionId ?? (await deriveCookielessSessionId(visitorId));
				await Promise.all([
					recordEvent({
						sessionId,
						visitorId,
						eventType: 'pageview',
						path,
						referrer,
						consentTier,
						debugOwnerId,
					}),
					upsertSession({
						id: sessionId,
						visitorId,
						entryPath: path,
						exitPath: path,
						consentTier,
						pairedAdminUserId: debugOwnerId,
					}),
				]);
			})
			.catch((err) => {
				console.error('[analytics] Failed to track pageview:', err);
			});
	}

	return response;
};
