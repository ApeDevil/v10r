import { getEntryPages, getExitPages, getTopTransitions } from '$lib/server/db/analytics/aggregations';
import { getSessionTimeline } from '$lib/server/db/analytics/queries';
import type { PageServerLoad } from './$types';

const RANGE_DAYS = 90;

export const load: PageServerLoad = async () => {
	const start = performance.now();

	try {
		// All four reads are Postgres now. This page used to stream a separate Neo4j
		// round trip for the flow graph, but that graph was populated by a seed
		// function with zero callers — so the Sankey rendered stale demo data
		// indefinitely while claiming to show real journeys.
		const [sessions, transitions, entryPages, exitPages] = await Promise.all([
			getSessionTimeline({ limit: 20 }),
			getTopTransitions(RANGE_DAYS, 20),
			getEntryPages(RANGE_DAYS, 10),
			getExitPages(RANGE_DAYS, 10),
		]);

		return {
			sessions,
			transitions,
			entryPages,
			exitPages,
			queryMs: Math.round((performance.now() - start) * 100) / 100,
		};
	} catch (err) {
		return {
			sessions: [],
			transitions: [],
			entryPages: [],
			exitPages: [],
			queryMs: Math.round((performance.now() - start) * 100) / 100,
			error: err instanceof Error ? err.message : 'Unknown database error',
		};
	}
};
