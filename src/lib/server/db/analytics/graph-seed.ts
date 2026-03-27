/**
 * Analytics graph seed — syncs PostgreSQL session data to Neo4j.
 * Creates Page nodes, Session nodes, and relationships between them.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { events, sessions } from '$lib/server/db/schema/analytics';
import { cypher } from '$lib/server/graph';

export async function seedAnalyticsGraph() {
	// Clear existing analytics graph data
	await cypher('MATCH (n) WHERE n:AnalyticsPage OR n:AnalyticsSession DETACH DELETE n');

	// Create page nodes from distinct paths
	const paths = await db.selectDistinct({ path: events.path }).from(events).where(eq(events.eventType, 'pageview'));

	for (const { path } of paths) {
		await cypher('MERGE (p:AnalyticsPage {path: $path}) SET p.title = $title', {
			path,
			title: path === '/' ? 'Home' : (path.split('/').pop() ?? path),
		});
	}

	// Create session nodes (limited to most recent 200 for demo)
	const recentSessions = await db.select().from(sessions).orderBy(sql`started_at DESC`).limit(200);

	for (const s of recentSessions) {
		await cypher(
			`MERGE (sess:AnalyticsSession {id: $id})
			 SET sess.startedAt = $startedAt,
			     sess.device = $device,
			     sess.country = $country`,
			{
				id: s.id,
				startedAt: s.startedAt.toISOString(),
				device: s.device ?? 'unknown',
				country: s.country ?? '??',
			},
		);

		// Entry and exit relationships
		await cypher(
			`MATCH (sess:AnalyticsSession {id: $id}), (p:AnalyticsPage {path: $path})
			 MERGE (sess)-[:ENTERED_VIA]->(p)`,
			{ id: s.id, path: s.entryPath },
		);

		if (s.exitPath) {
			await cypher(
				`MATCH (sess:AnalyticsSession {id: $id}), (p:AnalyticsPage {path: $path})
				 MERGE (sess)-[:EXITED_VIA]->(p)`,
				{ id: s.id, path: s.exitPath },
			);
		}
	}

	// Create VISITED relationships with sequence from events
	for (const s of recentSessions) {
		const sessionEvents = await db
			.select({ path: events.path, timestamp: events.timestamp })
			.from(events)
			.where(eq(events.sessionId, s.id))
			.orderBy(events.timestamp);

		for (let i = 0; i < sessionEvents.length; i++) {
			await cypher(
				`MATCH (sess:AnalyticsSession {id: $sessionId}), (p:AnalyticsPage {path: $path})
				 MERGE (sess)-[v:VISITED]->(p)
				 SET v.sequence = $seq, v.timestamp = $ts`,
				{
					sessionId: s.id,
					path: sessionEvents[i].path,
					seq: i,
					ts: sessionEvents[i].timestamp.toISOString(),
				},
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
