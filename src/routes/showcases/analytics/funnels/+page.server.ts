import type { PageServerLoad } from './$types';
import { getFunnelSteps } from '$lib/server/db/analytics/aggregations';

const FUNNEL_STEPS = [
	{ label: 'Landing', path: '/' },
	{ label: 'Docs', path: '/docs' },
	{ label: 'Pricing', path: '/pricing' },
	{ label: 'Signup', path: '/signup' },
];

export const load: PageServerLoad = async ({ url }) => {
	const range = Number(url.searchParams.get('range') ?? '90');
	const days = [7, 30, 90].includes(range) ? range : 90;
	const start = performance.now();

	try {
		const funnel = await getFunnelSteps(days, FUNNEL_STEPS);
		const queryMs = Math.round((performance.now() - start) * 100) / 100;

		return { funnel, days, queryMs };
	} catch (err) {
		return {
			funnel: [],
			days,
			error: err instanceof Error ? err.message : 'Unknown database error',
		};
	}
};
