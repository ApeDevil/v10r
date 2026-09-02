import { env } from '$env/dynamic/private';
import { retentionDays } from '$lib/server/retention';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		title: 'Privacy & Your Data',
		controllerEmail: env.PRIVACY_CONTACT_EMAIL ?? 'privacy@example.com',
		retention: {
			events: retentionDays('analytics-events'),
			consent: retentionDays('consent-events'),
		},
	};
};
