import { desc, eq } from 'drizzle-orm';
import { requireAdmin } from '$lib/server/auth/guards';
import { db } from '$lib/server/db';
import {
	getAudienceBreakdown,
	getConsentSplit,
	getFrictionSignals,
	getOverviewMetrics,
	getRollupFreshness,
	getTopPages,
	getTrafficTrend,
	getUserLaneStats,
	getWebVitals,
} from '$lib/server/db/analytics/aggregations';
import { getActiveSessionCount, getPairedSessionCount, getRecentEvents } from '$lib/server/db/analytics/queries';
import { jobExecution } from '$lib/server/db/schema/jobs';
import { hasActivePairedSession } from '$lib/server/pairing';
import { safeDeferPromise } from '$lib/server/utils/safe-defer';
import type { PageServerLoad } from './$types';

async function getLastCleanupStatus(): Promise<{
	startedAt: Date | null;
	status: 'success' | 'failure' | null;
	resultCount: number | null;
}> {
	const rows = await db
		.select({
			startedAt: jobExecution.startedAt,
			status: jobExecution.status,
			resultCount: jobExecution.resultCount,
		})
		.from(jobExecution)
		.where(eq(jobExecution.jobSlug, 'analytics-cleanup'))
		.orderBy(desc(jobExecution.startedAt))
		.limit(1);

	const row = rows[0];
	if (!row) return { startedAt: null, status: null, resultCount: null };
	return { startedAt: row.startedAt, status: row.status, resultCount: row.resultCount };
}

const VALID_RANGES = ['7', '30', '90'] as const;
type Range = (typeof VALID_RANGES)[number];

export const load: PageServerLoad = async ({ url, locals }) => {
	const { user } = requireAdmin(locals);

	const rangeParam = url.searchParams.get('range') ?? '30';
	const range: Range = (VALID_RANGES as readonly string[]).includes(rangeParam) ? (rangeParam as Range) : '30';
	const days = Number(range);

	// Eager: headline stats + consent breakdown + cleanup status + live-feed seed
	const [
		overview,
		consentSplit,
		lastCleanup,
		rollupLatestDate,
		recentEvents,
		activeSessions,
		pairedSessions,
		pairedActive,
	] = await Promise.all([
		getOverviewMetrics(days),
		getConsentSplit(days),
		getLastCleanupStatus(),
		getRollupFreshness(),
		getRecentEvents({ adminUserId: user.id, sinceId: 0, filter: 'all', limit: 50 }),
		getActiveSessionCount(),
		getPairedSessionCount(user.id),
		hasActivePairedSession(user.id),
	]);

	// Engagement metrics (avg duration, bounce rate) and the top-pages table come
	// from the rollup; traffic volume no longer does. Yesterday is the newest day
	// the job can ever have computed, so anything older than that means runs are
	// being missed — which went unnoticed for four days in production because
	// nothing on this page said how old the numbers were.
	const yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);
	const rollupStale = rollupLatestDate === null || rollupLatestDate < yesterday.toISOString().slice(0, 10);

	return {
		title: 'Analytics',
		range,
		overview,
		consentSplit,
		lastCleanup,
		rollupLatestDate,
		rollupStale,
		recentEvents,
		activeSessions,
		pairedSessions,
		pairedActive,
		// Deferred: chart + table data (streams in)
		trend: safeDeferPromise(getTrafficTrend(days), []),
		topPages: safeDeferPromise(getTopPages(days, 10), []),
		audience: safeDeferPromise(getAudienceBreakdown(days), {
			countries: [],
			devices: [],
			browsers: [],
			totalVisitors: 0,
			locatedVisitors: 0,
			classifiedVisitors: 0,
		}),
		vitals: safeDeferPromise(getWebVitals(days), []),
		friction: safeDeferPromise(getFrictionSignals(days, 12), []),
		userLane: safeDeferPromise(getUserLaneStats(days), { activeUsers: 0, events: 0, topRoutes: [] }),
	};
};
