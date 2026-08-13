import { getLaneHealth } from '$lib/server/perf';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const days = 30;
	return {
		days,
		lanes: await getLaneHealth(days).catch(() => ({ census: [], total: 0, prodShare: 0, devSamples: 0 })),
		/**
		 * The measured contamination effect, kept as data rather than baked into a
		 * translated sentence so the page states a number it can point at. Taken
		 * from the 30-day window that motivated the read-side filter.
		 */
		contamination: {
			metric: 'TTFB',
			contaminatedP75: 1051,
			honestP75: 1431,
		},
	};
};
