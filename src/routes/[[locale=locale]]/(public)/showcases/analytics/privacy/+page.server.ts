import { getConsentSplit, getDataAgeStats } from '$lib/server/db/analytics/aggregations';
import { retentionDays } from '$lib/server/retention';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	try {
		const [consent, dataAge] = await Promise.all([getConsentSplit(90), getDataAgeStats()]);

		return {
			consent,
			dataAge,
			eventRetentionDays: retentionDays('analytics-events'),
			aggregateRetentionDays: retentionDays('analytics-aggregates'),
		};
	} catch (err) {
		console.error('[analytics:privacy] Failed to load data:', err);
		return {
			consent: [],
			dataAge: { totalEvents: 0, oldestEvent: null, newestEvent: null, totalSessions: 0 },
			eventRetentionDays: retentionDays('analytics-events'),
			aggregateRetentionDays: retentionDays('analytics-aggregates'),
			error: 'Unable to load analytics data',
		};
	}
};
