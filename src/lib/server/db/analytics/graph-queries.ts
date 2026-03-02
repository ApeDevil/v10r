/**
 * Analytics graph queries — Neo4j journey and path analysis.
 * Returns user flow data for Sankey diagrams and path analysis.
 */
import { cypher } from '$lib/server/graph';
import type { JourneyPath } from '$lib/server/analytics/types';

/** Get top page-to-page transitions for Sankey diagram */
export async function getTopPaths(limit = 20): Promise<JourneyPath[]> {
	return cypher<JourneyPath>(
		`MATCH (a:AnalyticsPage)-[r:FOLLOWED_BY]->(b:AnalyticsPage)
		 RETURN a.path AS source, b.path AS target, r.count AS count, r.avgDurationMs AS avgDurationMs
		 ORDER BY r.count DESC
		 LIMIT $limit`,
		{ limit },
	);
}

/** Get entry page distribution */
export async function getEntryPages(limit = 10) {
	return cypher<{ path: string; count: number }>(
		`MATCH (s:AnalyticsSession)-[:ENTERED_VIA]->(p:AnalyticsPage)
		 RETURN p.path AS path, count(s) AS count
		 ORDER BY count DESC
		 LIMIT $limit`,
		{ limit },
	);
}

/** Get exit page distribution */
export async function getExitPages(limit = 10) {
	return cypher<{ path: string; count: number }>(
		`MATCH (s:AnalyticsSession)-[:EXITED_VIA]->(p:AnalyticsPage)
		 RETURN p.path AS path, count(s) AS count
		 ORDER BY count DESC
		 LIMIT $limit`,
		{ limit },
	);
}

/** Get full user journey paths (for path analysis) */
export async function getJourneyPaths(limit = 50) {
	return cypher<{ sessionId: string; path: string[]; pageCount: number }>(
		`MATCH (s:AnalyticsSession)-[v:VISITED]->(p:AnalyticsPage)
		 WITH s, p ORDER BY v.sequence
		 WITH s, collect(p.path) AS path
		 WHERE size(path) >= 2
		 RETURN s.id AS sessionId, path, size(path) AS pageCount
		 ORDER BY pageCount DESC
		 LIMIT $limit`,
		{ limit },
	);
}
