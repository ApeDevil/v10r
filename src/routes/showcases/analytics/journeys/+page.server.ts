import type { PageServerLoad } from './$types';
import { getTopPaths, getEntryPages, getExitPages } from '$lib/server/db/analytics/graph-queries';
import { getSessionTimeline } from '$lib/server/db/analytics/queries';

export const load: PageServerLoad = async () => {
	const start = performance.now();

	try {
		// Session list from PostgreSQL (fast, returned immediately)
		const sessions = await getSessionTimeline({ limit: 20 });

		// Graph queries from Neo4j (potentially slower, streamed)
		const graphPromise = Promise.all([
			getTopPaths(20),
			getEntryPages(10),
			getExitPages(10),
		]).catch((err) => {
			console.error('[analytics/journeys] Neo4j query failed:', err);
			return null;
		});

		const queryMs = Math.round((performance.now() - start) * 100) / 100;

		return {
			sessions,
			graph: graphPromise,
			queryMs,
		};
	} catch (err) {
		return {
			sessions: [],
			graph: Promise.resolve(null),
			error: err instanceof Error ? err.message : 'Unknown database error',
		};
	}
};
