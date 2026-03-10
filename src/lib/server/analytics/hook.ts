/**
 * Analytics collector hook — records pageview events server-side.
 * Fire-and-forget: never blocks the response.
 *
 * Wire into hooks.server.ts sequence when switching from synthetic to live data:
 *   sequence(sessionPopulate, analyticsCollector, csrfProtection, ...)
 */
import type { Handle } from '@sveltejs/kit';
import { ANALYTICS_CONSENT_COOKIE, ANALYTICS_SESSION_TIMEOUT_MS } from '$lib/server/config';
import { recordEvent, upsertSession } from '$lib/server/db/analytics/mutations';
import { hasConsent, hashVisitorId, parseConsentTier } from './consent';

export const analyticsCollector: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Only track GET requests to pages (not API, not assets)
	if (
		event.request.method !== 'GET' ||
		event.url.pathname.startsWith('/api/') ||
		event.url.pathname.startsWith('/_app/') ||
		event.url.pathname.includes('.')
	) {
		return response;
	}

	// Fire-and-forget: don't await, don't block response
	trackPageview(event).catch((err) => {
		console.error('[analytics] Failed to track pageview:', err);
	});

	return response;
};

async function trackPageview(event: Parameters<Handle>[0]['event']) {
	const ip = event.getClientAddress();
	const ua = event.request.headers.get('user-agent') ?? '';
	const visitorId = await hashVisitorId(`${ip}:${ua}`);

	// Read consent tier from cookie
	const consentTier = parseConsentTier(event.cookies.get(ANALYTICS_CONSENT_COOKIE));

	// Gate fields on consent level
	const referrer = hasConsent(consentTier, 'analytics')
		? (event.request.headers.get('referer') ?? undefined)
		: undefined;

	// Session ID from cookie or generate new (session cookie is strictly necessary)
	const sessionCookie = event.cookies.get('_v10r_sid');
	const sessionId = sessionCookie ?? `s_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

	if (!sessionCookie) {
		event.cookies.set('_v10r_sid', sessionId, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: ANALYTICS_SESSION_TIMEOUT_MS / 1000,
		});
	}

	await Promise.all([
		recordEvent({
			sessionId,
			visitorId,
			eventType: 'pageview',
			path: event.url.pathname,
			referrer,
			consentTier,
		}),
		upsertSession({
			id: sessionId,
			visitorId,
			entryPath: event.url.pathname,
			exitPath: event.url.pathname,
			consentTier,
		}),
	]);
}
