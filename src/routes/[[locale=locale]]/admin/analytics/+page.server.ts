import { desc, eq } from 'drizzle-orm';
import { requireAdmin } from '$lib/server/auth/guards';
import { db } from '$lib/server/db';
import {
	getConsentSplit,
	getOverviewMetrics,
	getTopPages,
	getTrafficTrend,
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
	const [overview, consentSplit, lastCleanup, recentEvents, activeSessions, pairedSessions, pairedActive] =
		await Promise.all([
			getOverviewMetrics(days),
			getConsentSplit(days),
			getLastCleanupStatus(),
			getRecentEvents({ adminUserId: user.id, sinceId: 0, filter: 'all', limit: 50 }),
			getActiveSessionCount(),
			getPairedSessionCount(user.id),
			hasActivePairedSession(user.id),
		]);

	return {
		title: 'Analytics',
		range,
		overview,
		consentSplit,
		lastCleanup,
		recentEvents,
		activeSessions,
		pairedSessions,
		pairedActive,
		// Deferred: chart + table data (streams in)
		trend: safeDeferPromise(getTrafficTrend(days), []),
		topPages: safeDeferPromise(getTopPages(days, 10), []),
	};
};
