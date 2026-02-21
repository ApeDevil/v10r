import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
	getLabelsWithCounts,
	getRelTypesWithCounts,
	getFullGraph,
} from '$lib/server/graph/showcase/queries';
import { reseedGraph } from '$lib/server/graph/showcase/seed';

export const load: PageServerLoad = async () => {
	const start = performance.now();

	try {
		const [labels, relTypes, graphData] = await Promise.all([
			getLabelsWithCounts(),
			getRelTypesWithCounts(),
			getFullGraph(),
		]);

		const queryMs = Math.round((performance.now() - start) * 100) / 100;

		return { labels, relTypes, graphData, queryMs };
	} catch (err) {
		return {
			labels: [],
			relTypes: [],
			graphData: { nodes: [], edges: [], entityTypes: [], relationshipTypes: [] },
			queryMs: Math.round((performance.now() - start) * 100) / 100,
			error: err instanceof Error ? err.message : 'Unknown database error',
		};
	}
};

export const actions: Actions = {
	reseed: async () => {
		try {
			await reseedGraph();
			return { success: true, message: 'Graph data reset to seed values.' };
		} catch (err) {
			return fail(500, {
				message: err instanceof Error ? err.message : 'Failed to reseed graph.',
			});
		}
	},
};
