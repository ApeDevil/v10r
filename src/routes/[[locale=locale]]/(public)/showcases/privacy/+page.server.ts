import { retentionDays } from '#lib/server/retention/index.ts';
import { PRIVACY_CONTACT_EMAIL } from '$app/env/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		title: 'Privacy & Your Data',
		controllerEmail: PRIVACY_CONTACT_EMAIL ?? 'privacy@example.com',
		retention: {
			events: retentionDays('analytics-events'),
			consent: retentionDays('consent-events'),
		},
	};
};
