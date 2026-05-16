import { ANALYTICS_AGGREGATE_RETENTION_DAYS, ANALYTICS_RETENTION_DAYS } from '$lib/server/config';
import { getConsentSplit, getDataAgeStats } from '$lib/server/db/analytics/aggregations';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const start = performance.now();

	try {
		const [consent, dataAge] = await Promise.all([getConsentSplit(90), getDataAgeStats()]);

		const queryMs = Math.round((performance.now() - start) * 100) / 100;

		return {
			consent,
			dataAge,
			retentionDays: ANALYTICS_RETENTION_DAYS,
			aggregateRetentionDays: ANALYTICS_AGGREGATE_RETENTION_DAYS,
			queryMs,
		};
	} catch (err) {
		console.error('[analytics:privacy] Failed to load data:', err);
		return {
			consent: [],
			dataAge: { totalEvents: 0, oldestEvent: null, newestEvent: null, totalSessions: 0 },
			retentionDays: ANALYTICS_RETENTION_DAYS,
			aggregateRetentionDays: ANALYTICS_AGGREGATE_RETENTION_DAYS,
			error: 'Unable to load analytics data',
		};
	}
};
