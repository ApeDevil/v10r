import { getFieldVitals, getLaneHealth, scoreSnapshot, snapshot } from '$lib/server/perf';
import type { PageServerLoad } from './$types';

/**
 * Public, and safe to be: every number here is an aggregate about the SITE, not
 * about a visitor. No identifiers, no per-session rows, no free text. The one
 * borderline field is `worstTarget`, which is a CSS selector for an element in
 * the public DOM — it describes the page, not the person who loaded it.
 */
export const load: PageServerLoad = async () => {
	const days = 30;

	const [vitals, lanes] = await Promise.all([
		getFieldVitals(days).catch(() => []),
		getLaneHealth(days).catch(() => ({ census: [], total: 0, prodShare: 0, devSamples: 0 })),
	]);

	return {
		days,
		vitals,
		lanes,
		lab: {
			generatedAt: snapshot.generatedAt,
			nodeEnv: snapshot.nodeEnv,
			metrics: snapshot.metrics,
			scored: scoreSnapshot(),
		},
	};
};
