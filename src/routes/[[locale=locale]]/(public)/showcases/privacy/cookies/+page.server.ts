import { CONSENT_COOKIE, CONSENT_MAX_AGE } from '$lib/server/analytics/config';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		title: 'Cookies — Admin & Privacy',
		consentCookieName: CONSENT_COOKIE,
		consentCookieDays: Math.round(CONSENT_MAX_AGE / 86_400),
	};
};
