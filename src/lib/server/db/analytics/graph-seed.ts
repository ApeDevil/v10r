/**
 * Analytics graph seed — syncs PostgreSQL session data to Neo4j.
 * Creates Page nodes, Session nodes, and relationships between them.
 */

import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { events, sessions } from '$lib/server/db/schema/analytics';
import { cypher } from '$lib/server/graph';

export async function seedAnalyticsGraph() {
	// Clear existing analytics graph data
	await cypher('MATCH (n) WHERE n:AnalyticsPage OR n:AnalyticsSession DETACH DELETE n');

	// Create page nodes from distinct paths (batch)
	const paths = await db.selectDistinct({ path: events.path }).from(events).where(eq(events.eventType, 'pageview'));

	if (paths.length > 0) {
		await cypher(
			`UNWIND $pages AS page
			 MERGE (p:AnalyticsPage {path: page.path})
			 SET p.title = page.title`,
			{
				pages: paths.map(({ path }) => ({
					path,
					title: path === '/' ? 'Home' : (path.split('/').pop() ?? path),
				})),
			},
		);
	}

	// Create session nodes (limited to most recent 200 for demo)
	const recentSessions = await db.select().from(sessions).orderBy(sql`started_at DESC`).limit(200);

	if (recentSessions.length > 0) {
		// Batch create all session nodes
		await cypher(
			`UNWIND $items AS s
			 MERGE (sess:AnalyticsSession {id: s.id})
			 SET sess.startedAt = s.startedAt,
			     sess.device = s.device,
			     sess.country = s.country`,
			{
				items: recentSessions.map((s) => ({
					id: s.id,
					startedAt: s.startedAt.toISOString(),
					device: s.device ?? 'unknown',
					country: s.country ?? '??',
				})),
			},
		);

		// Batch create ENTERED_VIA relationships
		await cypher(
			`UNWIND $items AS s
			 MATCH (sess:AnalyticsSession {id: s.id}), (p:AnalyticsPage {path: s.entryPath})
			 MERGE (sess)-[:ENTERED_VIA]->(p)`,
			{ items: recentSessions.map((s) => ({ id: s.id, entryPath: s.entryPath })) },
		);

		// Batch create EXITED_VIA relationships
		const withExit = recentSessions.filter((s) => s.exitPath);
		if (withExit.length > 0) {
			await cypher(
				`UNWIND $items AS s
				 MATCH (sess:AnalyticsSession {id: s.id}), (p:AnalyticsPage {path: s.exitPath})
				 MERGE (sess)-[:EXITED_VIA]->(p)`,
				{ items: withExit.map((s) => ({ id: s.id, exitPath: s.exitPath })) },
			);
		}
	}

	// Fetch all events for recent sessions in one query, then batch VISITED relationships
	const sessionIds = recentSessions.map((s) => s.id);
	if (sessionIds.length > 0) {
		const allEvents = await db
			.select({
				sessionId: events.sessionId,
				path: events.path,
				timestamp: events.timestamp,
			})
			.from(events)
			.where(inArray(events.sessionId, sessionIds))
			.orderBy(events.sessionId, events.timestamp);

		// Build visit items with sequence numbers per session
		const visitItems: Array<{ sessionId: string; path: string; seq: number; ts: string }> = [];
		let currentSessionId = '';
		let seq = 0;

		for (const evt of allEvents) {
			if (evt.sessionId !== currentSessionId) {
				currentSessionId = evt.sessionId;
				seq = 0;
			}
			visitItems.push({
				sessionId: evt.sessionId,
				path: evt.path,
				seq,
				ts: evt.timestamp.toISOString(),
			});
			seq++;
		}

		if (visitItems.length > 0) {
			await cypher(
				`UNWIND $items AS v
				 MATCH (sess:AnalyticsSession {id: v.sessionId}), (p:AnalyticsPage {path: v.path})
				 MERGE (sess)-[rel:VISITED]->(p)
				 SET rel.sequence = v.seq, rel.timestamp = v.ts`,
				{ items: visitItems },
			);
		}
	}

	// Compute FOLLOWED_BY relationships (page-to-page transitions)
	await cypher(
		`MATCH (s:AnalyticsSession)-[v1:VISITED]->(a:AnalyticsPage),
		       (s)-[v2:VISITED]->(b:AnalyticsPage)
		 WHERE v2.sequence = v1.sequence + 1
		 WITH a, b, count(*) AS cnt,
		      avg(duration.between(datetime(v1.timestamp), datetime(v2.timestamp)).milliseconds) AS avgMs
		 MERGE (a)-[r:FOLLOWED_BY]->(b)
		 SET r.count = cnt, r.avgDurationMs = toInteger(avgMs)`,
	);
}
