import { budgets, checkRatchets, isScoreable, scoreSnapshot, snapshot, snapshotAgeDays } from '$lib/server/perf';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	scored: scoreSnapshot(),
	ratchets: checkRatchets(),
	scoreable: isScoreable(),
	ageDays: snapshotAgeDays(),
	generatedAt: snapshot.generatedAt,
	nodeEnv: snapshot.nodeEnv,
	metrics: snapshot.metrics,
	/** Field budgets, shown as the published Core Web Vitals bands they mirror. */
	fieldBudgets: Object.entries(budgets)
		.filter(([, b]) => b.kind === 'field')
		.map(([key, b]) => ({ key, warn: b.warn, fail: b.fail, note: b.note })),
});
