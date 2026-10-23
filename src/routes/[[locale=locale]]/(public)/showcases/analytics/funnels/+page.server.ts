import { getFunnelSteps } from '$lib/server/db/analytics/aggregations';
import { readUrlState } from '$lib/state/url-state';
import { rangeParams } from '../range-params';
import type { PageServerLoad } from './$types';

const FUNNEL_STEPS = [
	{ label: 'Landing', path: '/' },
	{ label: 'Docs', path: '/docs' },
	{ label: 'Pricing', path: '/pricing' },
	{ label: 'Signup', path: '/signup' },
];

export const load: PageServerLoad = async ({ url }) => {
	const days = Number(readUrlState(url.searchParams, rangeParams('90')).range);
	const start = performance.now();

	try {
		const funnel = await getFunnelSteps(days, FUNNEL_STEPS);
		const queryMs = Math.round((performance.now() - start) * 100) / 100;

		return { funnel, queryMs };
	} catch (err) {
		return {
			funnel: [],
			error: err instanceof Error ? err.message : 'Unknown database error',
		};
	}
};
