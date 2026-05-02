import { env } from '$env/dynamic/private';
import {
	ANALYTICS_AGGREGATE_RETENTION_DAYS,
	ANALYTICS_RETENTION_DAYS,
	CONSENT_RETENTION_DAYS,
} from '$lib/server/config';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		title: 'Admin & Privacy',
		controllerEmail: env.ADMIN_EMAIL ?? 'stas-k@gmx.de',
		retention: {
			events: ANALYTICS_RETENTION_DAYS,
			sessions: ANALYTICS_RETENTION_DAYS,
			aggregates: ANALYTICS_AGGREGATE_RETENTION_DAYS,
			consent: CONSENT_RETENTION_DAYS,
		},
	};
};
