import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	getBrowserSplit,
	getCountrySplit,
	getDeviceSplit,
	getOverviewMetrics,
	getTopPages,
	getTrafficTrend,
} from '$lib/server/db/analytics/aggregations';
import { reseedAnalytics } from '$lib/server/db/analytics/seed';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const range = Number(url.searchParams.get('range') ?? '30');
	const days = [7, 30, 90].includes(range) ? range : 30;
	const start = performance.now();

	try {
		const [metrics, trend, topPages, devices, browsers, countries] = await Promise.all([
			getOverviewMetrics(days),
			getTrafficTrend(days),
			getTopPages(days),
			getDeviceSplit(days),
			getBrowserSplit(days),
			getCountrySplit(days),
		]);

		const queryMs = Math.round((performance.now() - start) * 100) / 100;

		return {
			metrics,
			trend,
			topPages,
			devices,
			browsers,
			countries,
			days,
			queryMs,
		};
	} catch (err) {
		return {
			metrics: { totalPageviews: 0, uniqueVisitors: 0, avgSessionDuration: 0, bounceRate: 0 },
			trend: [],
			topPages: [],
			devices: [],
			browsers: [],
			countries: [],
			days,
			error: err instanceof Error ? err.message : 'Unknown database error',
		};
	}
};

export const actions: Actions = {
	reseed: async () => {
		try {
			await reseedAnalytics(db);
			return { success: true, message: 'Analytics data reset to seed values.' };
		} catch (err) {
			return fail(500, {
				message: err instanceof Error ? err.message : 'Failed to reseed analytics.',
			});
		}
	},
};
