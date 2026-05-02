/**
 * My Data — shows what the analytics system could collect about the current visitor.
 * Each data point is grouped by the consent tier that would enable it.
 */

import { hashVisitorId, parseConsentTier } from '$lib/server/analytics/consent';
import { ANALYTICS_CONSENT_COOKIE } from '$lib/server/config';
import type { PageServerLoad } from './$types';

function maskIp(ip: string): string {
	if (ip.includes(':')) {
		// IPv6: show first 2 groups, mask the rest
		const parts = ip.split(':');
		return `${parts.slice(0, 2).join(':')}:xxxx:xxxx:xxxx:xxxx`;
	}
	// IPv4: show first 2 octets, mask last 2
	const parts = ip.split('.');
	return `${parts[0]}.${parts[1]}.xxx.xxx`;
}

export const load: PageServerLoad = async ({ request, cookies, getClientAddress, setHeaders }) => {
	// Prevent caching of personal data
	setHeaders({ 'Cache-Control': 'no-store, private' });

	const ip = getClientAddress();
	const ua = request.headers.get('user-agent') ?? '';
	const acceptLanguage = request.headers.get('accept-language') ?? '';
	const referrer = request.headers.get('referer') ?? '';
	const visitorId = await hashVisitorId(`${ip}:${ua}`);
	const consentTier = parseConsentTier(cookies.get(ANALYTICS_CONSENT_COOKIE));

	return {
		consentTier,
		necessary: {
			visitorId,
			path: '/showcases/analytics/my-data',
			sessionCookie: cookies.get('_v10r_sid') ? 'present' : 'not set',
		},
		analytics: {
			referrer: referrer || null,
			acceptLanguage,
			maskedIp: maskIp(ip),
			userAgent: ua,
		},
		full: {
			rawIpNote: 'Raw IP is never stored — only the hash above',
		},
		hashing: {
			maskedIp: maskIp(ip),
			uaTruncated: ua.length > 50 ? `${ua.slice(0, 50)}...` : ua,
			resultHash: visitorId,
		},
	};
};
