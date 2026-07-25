/**
 * My Data — shows what the analytics system could collect about the current visitor.
 * Each data point is grouped by the consent tier that would enable it.
 */

import { hashVisitorId, parseConsentTier } from '$lib/server/analytics/consent';
import { classifyUserAgent, geoFromHeaders } from '$lib/server/analytics/enrich';
import { ANALYTICS_CONSENT_COOKIE, ANALYTICS_SESSION_COOKIE } from '$lib/server/config';
import { maskIp } from '$lib/server/privacy';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, cookies, getClientAddress, setHeaders }) => {
	// Prevent caching of personal data
	setHeaders({ 'Cache-Control': 'no-store, private' });

	const ip = getClientAddress();
	const ua = request.headers.get('user-agent') ?? '';
	const acceptLanguage = request.headers.get('accept-language') ?? '';
	const referrer = request.headers.get('referer') ?? '';
	const visitorId = await hashVisitorId(`${ip}:${ua}`);
	const consentTier = parseConsentTier(cookies.get(ANALYTICS_CONSENT_COOKIE));
	const { device, browser } = classifyUserAgent(ua);

	return {
		consentTier,
		necessary: {
			visitorId,
			path: '/showcases/analytics/my-data',
			sessionCookie: cookies.get(ANALYTICS_SESSION_COOKIE) ? 'present' : 'not set',
			country: geoFromHeaders(request.headers) ?? 'not resolved',
		},
		analytics: {
			referrer: referrer || null,
			acceptLanguage,
			maskedIp: maskIp(ip),
			userAgent: ua,
			device,
			browser,
		},
		rawIpNote: 'Raw IP is never stored — only the hash above',
		hashing: {
			maskedIp: maskIp(ip),
			uaTruncated: ua.length > 50 ? `${ua.slice(0, 50)}...` : ua,
			resultHash: visitorId,
		},
	};
};
