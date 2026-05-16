import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { Actions, PageServerLoad } from './$types';

async function measureConnection() {
	const start = performance.now();

	try {
		const result = await db.execute(sql`
			SELECT
				version()                                AS pg_version,
				current_database()                       AS db_name,
				current_schema()                         AS current_schema,
				pg_size_pretty(pg_database_size(current_database())) AS db_size,
				(SELECT count(*) FROM pg_stat_activity)  AS active_connections
		`);

		const latencyMs = Math.round((performance.now() - start) * 100) / 100;
		const rows = Array.isArray(result) ? result : result.rows;
		const meta = rows[0] as Record<string, string>;

		return {
			title: 'Connection - Relational - Showcases',
			connected: true,
			latencyMs,
			pgVersion: meta.pg_version,
			dbName: meta.db_name,
			currentSchema: meta.current_schema,
			dbSize: meta.db_size,
			activeConnections: Number(meta.active_connections),
			measuredAt: new Date().toISOString(),
		};
	} catch (err) {
		const latencyMs = Math.round((performance.now() - start) * 100) / 100;

		return {
			connected: false,
			latencyMs,
			error: err instanceof Error ? err.message : 'Unknown database error',
			pgVersion: null,
			dbName: null,
			currentSchema: null,
			dbSize: null,
			activeConnections: null,
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
