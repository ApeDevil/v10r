import { parseAnalyticsRange } from '$lib/server/admin';
import { requireAdmin } from '$lib/server/auth/guards';
import {
	checkRatchets,
	getFieldVitals,
	getIdleGapProfile,
	getLaneHealth,
	getRouteHotPaths,
	idleGapIsReadable,
	isScoreable,
	scoreSnapshot,
	snapshot,
	snapshotAgeDays,
} from '$lib/server/perf';
import { safeDeferPromise } from '$lib/server/utils/safe-defer';
import type { PageServerLoad } from './$types';

/**
 * The lab half is synchronous — it is a committed JSON file, not a query — so it
 * renders in the first byte. The four field panels are deferred independently:
 * each is a separate round trip to Neon, and a slow one should not hold the
 * others behind it.
 */
export const load: PageServerLoad = ({ url, locals }) => {
	requireAdmin(locals);

	const { range, days } = parseAnalyticsRange(url);

	return {
		title: 'Performance',
		range,
		days,
		lab: {
			generatedAt: snapshot.generatedAt,
			gitSha: snapshot.gitSha,
			nodeEnv: snapshot.nodeEnv,
			metrics: snapshot.metrics,
			scored: scoreSnapshot(),
			ratchets: checkRatchets(),
			scoreable: isScoreable(),
			ageDays: snapshotAgeDays(),
		},
		vitals: safeDeferPromise(getFieldVitals(days), []),
		lanes: safeDeferPromise(getLaneHealth(days), { census: [], total: 0, prodShare: 0, devSamples: 0 }),
		idleGap: safeDeferPromise(
			getIdleGapProfile(days).then((rows) => ({ rows, readable: idleGapIsReadable(rows) })),
			{ rows: [], readable: false },
		),
		hotPaths: safeDeferPromise(getRouteHotPaths(days, 12), []),
	};
};
