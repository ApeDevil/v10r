import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { cypher } from '$lib/server/graph';
import { Neo4jError } from '$lib/server/graph/errors';
import {
	getAllNodes,
	getNodeWithConnections,
	findShortestPath,
	getRecommendations,
} from '$lib/server/graph/showcase/queries';

/** Block write operations in REPL */
const WRITE_PATTERN = /\b(CREATE|MERGE|SET|DELETE|DETACH|REMOVE|DROP|CALL\s+\{)\b/i;

export const load: PageServerLoad = async () => {
	try {
		const nodes = await getAllNodes();
		return { nodes };
	} catch (err) {
		return {
			nodes: [],
			error: err instanceof Error ? err.message : 'Unknown database error',
		};
	}
};

export const actions: Actions = {
	browse: async ({ request }) => {
		const formData = await request.formData();
		const elementId = formData.get('elementId') as string;
		if (!elementId) return fail(400, { message: 'No node selected.' });

		try {
			const node = await getNodeWithConnections(elementId);
			if (!node) return fail(404, { message: 'Node not found.' });
			return { success: true, browseResult: node };
		} catch (err) {
			return fail(500, { message: err instanceof Error ? err.message : 'Browse failed.' });
		}
	},

	shortestPath: async ({ request }) => {
		const formData = await request.formData();
		const fromId = formData.get('fromId') as string;
		const toId = formData.get('toId') as string;
		if (!fromId || !toId) return fail(400, { message: 'Select both nodes.' });
		if (fromId === toId) return fail(400, { message: 'Select two different nodes.' });

		try {
			const path = await findShortestPath(fromId, toId);
			if (path.length === 0) return { success: true, pathResult: [], pathMessage: 'No path found between these nodes.' };
			return { success: true, pathResult: path };
		} catch (err) {
			return fail(500, { message: err instanceof Error ? err.message : 'Path query failed.' });
		}
	},

	recommend: async ({ request }) => {
		const formData = await request.formData();
		const nodeId = formData.get('nodeId') as string;
		if (!nodeId) return fail(400, { message: 'No node selected.' });

		try {
			const recommendations = await getRecommendations(nodeId);
			return { success: true, recommendations };
		} catch (err) {
			return fail(500, { message: err instanceof Error ? err.message : 'Recommendation query failed.' });
		}
	},

	repl: async ({ request }) => {
		const formData = await request.formData();
		const query = (formData.get('query') as string)?.trim();
		if (!query) return fail(400, { message: 'Enter a Cypher query.' });

		if (WRITE_PATTERN.test(query)) {
			return fail(400, { message: 'Write operations are not allowed in the REPL. Use read-only queries (MATCH, RETURN, etc.).' });
		}

		try {
			const rows = await cypher(query, undefined, { timeoutMs: 10_000 });
			const columns = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
			return { success: true, replResult: { columns, rows: rows as Record<string, unknown>[] } };
		} catch (err) {
			if (err instanceof Neo4jError) {
				return fail(400, { message: err.message });
			}
			return fail(500, { message: err instanceof Error ? err.message : 'Query failed.' });
		}
	},
};
