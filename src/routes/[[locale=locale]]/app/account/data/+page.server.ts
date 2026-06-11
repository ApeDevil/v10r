/**
 * YOUR DATA — the authenticated transparency mirror (GDPR Art 15 surface).
 *
 * First page after first sign-up (app/+layout.server.ts redirects here once
 * with ?welcome=1) and permanently re-visitable afterwards.
 *
 * Instant data (no DB cost): cookies on the device, the live connection the
 * server sees right now. The cross-domain PersonalDataReport is returned as
 * an UNAWAITED promise — SvelteKit streams it and the page renders each
 * section as it resolves.
 *
 * Deliberately absent: the anonymous pre-signup analytics trail. Linking the
 * hashed visitorId to an identified user is re-identification without a
 * documented Art 6(4) basis — see $lib/server/privacy/report.ts.
 */
import { cookieName as PARAGLIDE_LOCALE_COOKIE } from '$lib/i18n';
import { parseConsentTier } from '$lib/server/analytics/consent';
import { requireAuth } from '$lib/server/auth/guards';
import { ANALYTICS_CONSENT_COOKIE } from '$lib/server/config';
import { collectUserData } from '$lib/server/privacy';
import type { PageServerLoad } from './$types';

export const prerender = false;

/** Cookie values safe to echo back. Everything else: presence only (session tokens!). */
const SAFE_VALUE_COOKIES = new Set<string>([ANALYTICS_CONSENT_COOKIE, PARAGLIDE_LOCALE_COOKIE]);

export const load: PageServerLoad = async ({ locals, url, cookies, request, getClientAddress, setHeaders }) => {
	const { user, session } = requireAuth(locals, url.pathname);

	// Personal data — never cacheable by a CDN/proxy for another user
	setHeaders({ 'Cache-Control': 'no-store, private' });

	return {
		title: 'Your data',
		welcome: url.searchParams.get('welcome') === '1',
		consentTier: parseConsentTier(cookies.get(ANALYTICS_CONSENT_COOKIE)),
		deviceCookies: cookies.getAll().map((c) => ({
			name: c.name,
			value: SAFE_VALUE_COOKIES.has(c.name) ? c.value : null,
		})),
		live: {
			ip: getClientAddress(),
			userAgent: request.headers.get('user-agent'),
			acceptLanguage: request.headers.get('accept-language'),
		},
		// Unawaited — streamed; the page renders sections via {#await}
		report: collectUserData(user.id, { currentSessionId: session.id }),
	};
};
