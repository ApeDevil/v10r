import { fail } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/http/guards';
import { getFullGraph, getLabelsWithCounts, getRelTypesWithCounts } from '$lib/server/showcases/graph/queries';
import { reseedGraph } from '$lib/server/showcases/graph/seed';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const start = performance.now();
	const admin = isAdmin(locals.user);

	try {
		const [labels, relTypes, graphData] = await Promise.all([
			getLabelsWithCounts(),
			getRelTypesWithCounts(),
			getFullGraph(),
		]);

		const queryMs = Math.round((performance.now() - start) * 100) / 100;

		return { title: 'Model - Graph - Showcases', labels, relTypes, graphData, queryMs, isAdmin: admin };
	} catch (err) {
		return {
			labels: [],
			relTypes: [],
			graphData: { nodes: [], edges: [], entityTypes: [], relationshipTypes: [] },
			queryMs: Math.round((performance.now() - start) * 100) / 100,
			isAdmin: admin,
			error: err instanceof Error ? err.message : 'Unknown database error',
		};
	}
};

export const actions: Actions = {
	reseed: async ({ locals }) => {
		// DETACH DELETE + re-CREATE of the demo graph — admin-only (it mutates the shared
		// Neo4j instance). Public visitors can view the model but not reseed it.
		if (!isAdmin(locals.user)) {
			return fail(403, { message: 'Reseeding is restricted to administrators.' });
		}
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
