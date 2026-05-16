import { ANALYTICS_CONSENT_COOKIE, ANALYTICS_CONSENT_MAX_AGE } from '$lib/server/config';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		title: 'Cookies — Admin & Privacy',
		consentCookieName: ANALYTICS_CONSENT_COOKIE,
		consentCookieDays: Math.round(ANALYTICS_CONSENT_MAX_AGE / 86_400),
	};
};
