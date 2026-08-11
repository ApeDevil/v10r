import { fail } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { isAdmin } from '$lib/server/auth/guards';
import { db } from '$lib/server/db';
import {
	getAudienceBreakdown,
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
		const [metrics, trend, topPages, audience] = await Promise.all([
			getOverviewMetrics(days),
			getTrafficTrend(days),
			getTopPages(days),
			getAudienceBreakdown(days),
		]);

		const queryMs = Math.round((performance.now() - start) * 100) / 100;

		return {
			metrics,
			trend,
			topPages,
			devices: audience.devices,
			browsers: audience.browsers,
			countries: audience.countries,
			days,
			queryMs,
		};
	} catch (err) {
		return {
			metrics: {
				totalPageviews: 0,
				uniqueVisitors: 0,
				avgSessionDuration: 0,
				bounceRate: 0,
				unconfirmedPageviews: 0,
				unconfirmedVisitors: 0,
			},
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
	reseed: async ({ locals }) => {
		// reseedAnalytics TRUNCATEs three production analytics tables. In dev that
		// is the point of the demo button; in production only an admin may pull
		// that trigger.
		if (!dev && !isAdmin(locals.user)) {
			return fail(403, { message: 'Reseeding is restricted to admins in production.' });
		}
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
