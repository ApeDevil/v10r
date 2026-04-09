import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	computePercentage,
	computeThreshold,
	FREE_TIER_LIMITS,
	type NeonMetrics,
	type NeonTableInfo,
	type ProviderResult,
	sanitizeError,
} from './index';

export async function fetchNeonMetrics(): Promise<ProviderResult<NeonMetrics>> {
	const start = performance.now();

	try {
		const [sizeResult, tableResult] = await Promise.all([
			db.execute(sql`SELECT pg_database_size(current_database()) AS total_bytes`),
			db.execute(sql`
				SELECT
					n.nspname AS schema_name,
					c.relname AS table_name,
					pg_total_relation_size(c.oid) AS total_bytes,
					pg_relation_size(c.oid) AS table_bytes,
					pg_indexes_size(c.oid) AS index_bytes,
					s.n_live_tup AS live_rows,
					s.n_dead_tup AS dead_rows,
					s.last_autovacuum,
					s.last_autoanalyze
				FROM pg_class c
				JOIN pg_namespace n ON n.oid = c.relnamespace
				LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
				WHERE c.relkind = 'r'
					AND n.nspname IN ('auth','ai','app','jobs','analytics','rag','notifications','showcase')
				ORDER BY pg_total_relation_size(c.oid) DESC
			`),
		]);

		const latencyMs = Math.round((performance.now() - start) * 100) / 100;

		const sizeRows = Array.isArray(sizeResult) ? sizeResult : sizeResult.rows;
		const totalBytes = Number((sizeRows[0] as Record<string, unknown>).total_bytes);

		const tableRows = Array.isArray(tableResult) ? tableResult : tableResult.rows;
		const tables: NeonTableInfo[] = (tableRows as Record<string, unknown>[]).map((row) => ({
			schema: row.schema_name as string,
			table: row.table_name as string,
			totalBytes: Number(row.total_bytes),
			tableBytes: Number(row.table_bytes),
			indexBytes: Number(row.index_bytes),
			liveRows: Number(row.live_rows ?? 0),
			deadRows: Number(row.dead_rows ?? 0),
			lastAutovacuum: row.last_autovacuum ? String(row.last_autovacuum) : null,
			lastAutoanalyze: row.last_autoanalyze ? String(row.last_autoanalyze) : null,
		}));

		const limitBytes = FREE_TIER_LIMITS.neon.storageBytes;

		return {
			status: 'ok',
			data: {
				totalBytes,
				limitBytes,
				percentage: computePercentage(totalBytes, limitBytes),
				threshold: computeThreshold(totalBytes, limitBytes),
				tables,
			},
			error: null,
			measuredAt: new Date().toISOString(),
			latencyMs,
		};
	} catch (err) {
		const latencyMs = Math.round((performance.now() - start) * 100) / 100;

		return {
			status: 'unavailable',
			data: null,
			error: sanitizeError(err),
			measuredAt: new Date().toISOString(),
			latencyMs,
		};
	}
}
