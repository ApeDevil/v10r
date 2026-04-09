import { requireAdmin } from '$lib/server/auth/guards';
import {
	getConsentSplit,
	getOverviewMetrics,
	getTopPages,
	getTrafficTrend,
} from '$lib/server/db/analytics/aggregations';
import { safeDeferPromise } from '$lib/server/utils/safe-defer';
import type { PageServerLoad } from './$types';

const VALID_RANGES = ['7', '30', '90'] as const;
type Range = (typeof VALID_RANGES)[number];

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);

	const rangeParam = url.searchParams.get('range') ?? '30';
	const range: Range = (VALID_RANGES as readonly string[]).includes(rangeParam) ? (rangeParam as Range) : '30';
	const days = Number(range);

	// Eager: headline stats + consent breakdown (fast aggregate queries)
	const [overview, consentSplit] = await Promise.all([getOverviewMetrics(days), getConsentSplit(days)]);

	return {
		range,
		overview,
		consentSplit,
		// Deferred: chart + table data (streams in)
		trend: safeDeferPromise(getTrafficTrend(days), []),
		topPages: safeDeferPromise(getTopPages(days, 10), []),
	};
};
