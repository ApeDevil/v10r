/**
 * Consent form actions — progressive enhancement fallback + audit trail.
 * The banner sets cookies client-side for instant reactivity,
 * then calls these actions via fetch for server-side audit recording.
 *
 * Rate-limited: this is an unauthenticated write into the consent audit table
 * (the GDPR Art. 7(1) evidence trail, retained ~13 months) — without a limiter
 * it is a free DB-write amplifier. 10/hour per IP is far above any legitimate
 * banner interaction rate.
 */

import { fail } from '@sveltejs/kit';
import { ipLimitKey } from '$lib/server/abuse';
import { CONSENT_COOKIE, CONSENT_MAX_AGE } from '$lib/server/analytics/config';
import { parseConsentTier } from '$lib/server/analytics/consent';
import { deriveUaHash, deriveVisitorId } from '$lib/server/analytics/visitor';
import { recordConsentEvent } from '$lib/server/db/analytics/consent-mutations';
import { getClientIp } from '$lib/server/http/client-ip';
import { createLimiter } from '$lib/server/http/rate-limit';
import { deferAfterResponse } from '$lib/server/platform';
import type { Actions } from './$types';

const limiter = createLimiter('rl:consent:set', 10, '1 h');

export const actions: Actions = {
	set: async (event) => {
		const { request, cookies } = event;
		const ip = getClientIp(event);
		const { success } = await limiter.limit(ipLimitKey(ip));
		if (!success) return fail(429, { error: 'Rate limited' });

		const formData = await request.formData();
		const raw = formData.get('tier');
		if (typeof raw !== 'string') return fail(400, { error: 'Missing tier' });

		const tier = parseConsentTier(raw);

		// Determine previous tier for audit trail
		const previousRaw = cookies.get(CONSENT_COOKIE);
		const previousTier = previousRaw ? parseConsentTier(previousRaw) : null;
		const action = previousTier === null ? 'grant' : 'change';

		// Set cookie (server-side, matches client-side cookie)
		cookies.set(CONSENT_COOKIE, tier, {
			path: '/',
			httpOnly: false,
			secure: true,
			sameSite: 'lax',
			maxAge: CONSENT_MAX_AGE,
		});

		// The cookie is the critical work — it is what the visitor's choice actually
		// changes. The audit-trail row is its tail.
		const ua = request.headers.get('user-agent') ?? '';
		const visitorId = await deriveVisitorId(ip ?? '', ua);
		const uaHash = await deriveUaHash(ua);

		deferAfterResponse('consent:record', () =>
			recordConsentEvent({
				visitorId,
				action,
				tierBefore: previousTier,
				tierAfter: tier,
				uaHash,
			}),
		);
	},
};
