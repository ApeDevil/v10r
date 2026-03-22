import { requireAdmin } from '$lib/server/auth/guards';
import { fetchNeonMetrics } from '$lib/server/monitoring/neon';
import { fetchNeo4jMetrics } from '$lib/server/monitoring/neo4j';
import { fetchUpstashMetrics } from '$lib/server/monitoring/upstash';
import { fetchR2Metrics } from '$lib/server/monitoring/r2';
import type { ProviderResult } from '$lib/server/monitoring';
import type { Actions, PageServerLoad } from './$types';

function settledToResult<T>(
	result: PromiseSettledResult<ProviderResult<T>>,
): ProviderResult<T> {
	if (result.status === 'fulfilled') return result.value;
	return {
		status: 'unavailable',
		data: null,
		error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
		measuredAt: new Date().toISOString(),
		latencyMs: 0,
	};
}

export const load: PageServerLoad = async ({ depends }) => {
	depends('admin:db');

	const [upstashResult, r2Result] = await Promise.allSettled([
		fetchUpstashMetrics(),
		fetchR2Metrics(),
	]);

	return {
		neon: fetchNeonMetrics(),
		neo4j: fetchNeo4jMetrics(),
		upstash: settledToResult(upstashResult),
		r2: settledToResult(r2Result),
	};
};

export const actions: Actions = {
	retest: async ({ locals }) => {
		requireAdmin(locals);

		const [neon, neo4j, upstash, r2] = await Promise.allSettled([
			fetchNeonMetrics(),
			fetchNeo4jMetrics(),
			fetchUpstashMetrics(),
			fetchR2Metrics(),
		]);

		return {
			neon: settledToResult(neon),
			neo4j: settledToResult(neo4j),
			upstash: settledToResult(upstash),
			r2: settledToResult(r2),
		};
	},
};
