import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { ANALYTICS_CONSENT_COOKIE, ANALYTICS_SESSION_TIMEOUT_MS } from '$lib/server/config';
import { recordEvent, upsertSession } from '$lib/server/db/analytics/mutations';
import { type ConsentTier, deriveCookielessSessionId, hasConsent, hashVisitorId, parseConsentTier } from './consent';

const BOT_UA_RE =
	/bot|crawler|spider|slurp|baiduspider|facebookexternalhit|whatsapp|twitterbot|linkedinbot|googlebot|bingbot|yandexbot|duckduckbot|applebot|prerender|headless|lighthouse/i;

interface TrackContext {
	sessionId: string;
	visitorId: string;
	consentTier: ConsentTier;
	referrer: string | undefined;
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

	// Compute identifiers + set session cookie BEFORE resolve, so
	// Set-Cookie can still be appended to the outgoing response headers.
	let context: TrackContext | null = null;
	if (shouldTrack) {
		const ip = event.getClientAddress();
		const ua = event.request.headers.get('user-agent') ?? '';
		const visitorId = await hashVisitorId(`${ip}:${ua}`);
		const consentTier = parseConsentTier(event.cookies.get(ANALYTICS_CONSENT_COOKIE));
		const referrer = hasConsent(consentTier, 'analytics')
			? (event.request.headers.get('referer') ?? undefined)
			: undefined;

		// TDDDG §25 / ePrivacy Art 5(3): the session cookie writes to terminal
		// equipment and is not strictly necessary — setting (or reading) it
		// requires at least 'analytics' consent. Without consent, fall back to
		// a cookieless daily session id derived from the visitor hash.
		let sessionId: string;
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
		} else {
			// Consent absent or withdrawn — remove a stale cookie from a prior grant.
			if (event.cookies.get('_v10r_sid')) {
				event.cookies.delete('_v10r_sid', { path: '/' });
			}
			sessionId = await deriveCookielessSessionId(visitorId);
		}

		context = { sessionId, visitorId, consentTier, referrer };
	}

	const response = await resolve(event);

	if (context) {
		const { sessionId, visitorId, consentTier, referrer } = context;
		const debugOwnerId = event.locals.debugOwnerId ?? null;
		// Fire-and-forget — DB writes only, no cookie ops here.
		Promise.all([
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
		]).catch((err) => {
			console.error('[analytics] Failed to track pageview:', err);
		});
	}

	return response;
};
