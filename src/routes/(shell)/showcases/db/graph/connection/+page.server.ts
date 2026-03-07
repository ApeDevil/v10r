import type { PageServerLoad, Actions } from './$types';
import { verifyConnection } from '$lib/server/graph/showcase/queries';

async function measureConnection() {
	const start = performance.now();

	try {
		const info = await verifyConnection();
		const latencyMs = Math.round((performance.now() - start) * 100) / 100;

		return {
			connected: true,
			latencyMs,
			neo4jVersion: info.neo4jVersion,
			edition: info.edition,
			nodeCount: info.nodeCount,
			relCount: info.relCount,
			labelCount: info.labelCount,
			relTypeCount: info.relTypeCount,
			measuredAt: new Date().toISOString(),
		};
	} catch (err) {
		const latencyMs = Math.round((performance.now() - start) * 100) / 100;

		return {
			connected: false,
			latencyMs,
			error: err instanceof Error ? err.message : 'Unknown database error',
			neo4jVersion: null,
			edition: null,
			nodeCount: null,
			relCount: null,
			labelCount: null,
			relTypeCount: null,
			measuredAt: new Date().toISOString(),
		};
	}
}

export const load: PageServerLoad = async () => {
	return measureConnection();
};

export const actions: Actions = {
	retest: async () => {
		return measureConnection();
	},
};
