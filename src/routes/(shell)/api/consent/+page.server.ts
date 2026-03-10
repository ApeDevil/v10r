/**
 * Consent form actions — progressive enhancement fallback + audit trail.
 * The banner sets cookies client-side for instant reactivity,
 * then calls these actions via fetch for server-side audit recording.
 */

import { fail } from '@sveltejs/kit';
import { hashVisitorId, parseConsentTier } from '$lib/server/analytics/consent';
import { ANALYTICS_CONSENT_COOKIE, ANALYTICS_CONSENT_MAX_AGE } from '$lib/server/config';
import { recordConsentEvent } from '$lib/server/db/analytics/consent-mutations';
import type { Actions } from './$types';

export const actions: Actions = {
	set: async ({ request, cookies, getClientAddress }) => {
		const formData = await request.formData();
		const raw = formData.get('tier');
		if (typeof raw !== 'string') return fail(400, { error: 'Missing tier' });

		const tier = parseConsentTier(raw);

		// Determine previous tier for audit trail
		const previousRaw = cookies.get(ANALYTICS_CONSENT_COOKIE);
		const previousTier = previousRaw ? parseConsentTier(previousRaw) : null;
		const action = previousTier === null ? 'grant' : 'change';

		// Set cookie (server-side, matches client-side cookie)
		cookies.set(ANALYTICS_CONSENT_COOKIE, tier, {
			path: '/',
			httpOnly: false,
			secure: true,
			sameSite: 'lax',
			maxAge: ANALYTICS_CONSENT_MAX_AGE,
		});

		// Record consent event in audit trail (fire-and-forget)
		const ip = getClientAddress();
		const ua = request.headers.get('user-agent') ?? '';
		const visitorId = await hashVisitorId(`${ip}:${ua}`);
		const uaHash = await hashVisitorId(ua);

		recordConsentEvent({
			visitorId,
			action,
			tierBefore: previousTier,
			tierAfter: tier,
			uaHash,
		}).catch((err) => {
			console.error('[consent] Failed to record consent event:', err);
		});

		return { success: true, tier };
	},

	clear: async ({ cookies, request, getClientAddress }) => {
		const previousRaw = cookies.get(ANALYTICS_CONSENT_COOKIE);
		const previousTier = previousRaw ? parseConsentTier(previousRaw) : null;

		cookies.delete(ANALYTICS_CONSENT_COOKIE, { path: '/' });

		if (previousTier) {
			const ip = getClientAddress();
			const ua = request.headers.get('user-agent') ?? '';
			const visitorId = await hashVisitorId(`${ip}:${ua}`);
			const uaHash = await hashVisitorId(ua);

			recordConsentEvent({
				visitorId,
				action: 'withdraw',
				tierBefore: previousTier,
				tierAfter: 'necessary',
				uaHash,
			}).catch((err) => {
				console.error('[consent] Failed to record withdrawal event:', err);
			});
		}

		return { success: true };
	},
};
