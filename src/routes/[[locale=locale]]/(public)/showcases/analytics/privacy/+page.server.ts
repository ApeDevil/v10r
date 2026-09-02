import { getConsentSplit, getDataAgeStats } from '$lib/server/db/analytics/aggregations';
import { retentionDays } from '$lib/server/retention';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const start = performance.now();

	try {
		const [consent, dataAge] = await Promise.all([getConsentSplit(90), getDataAgeStats()]);

		const queryMs = Math.round((performance.now() - start) * 100) / 100;

		return {
			consent,
			dataAge,
			eventRetentionDays: retentionDays('analytics-events'),
			aggregateRetentionDays: retentionDays('analytics-aggregates'),
			queryMs,
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
