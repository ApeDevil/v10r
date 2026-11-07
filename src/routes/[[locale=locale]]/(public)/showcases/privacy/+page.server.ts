import { retentionDays } from '#lib/server/retention/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		title: 'Privacy & Your Data',
		retention: {
			events: retentionDays('analytics-events'),
			consent: retentionDays('consent-events'),
		},
	};
};
