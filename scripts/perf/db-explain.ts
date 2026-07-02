#!/usr/bin/env bun
/**
 * DB performance probe — confirms the static-review findings against the real database.
 *
 * Runs read-only diagnostics (counts, EXPLAIN ANALYZE, GUC checks) so we measure
 * actual query plans + data-volume instead of guessing. Safe: every statement is a
 * SELECT / EXPLAIN / SHOW — no mutations.
 *
 * Usage (from host, via the container so env + node_modules are present):
 *   podman compose run --rm --entrypoint bun v10r run scripts/perf/db-explain.ts
 *
 * Targets NEON_DATABASE_URL_PROD (the real corpus). Each probe is independently
 * try/caught so one failure never aborts the rest.
 */
import { neon } from '@neondatabase/serverless';

const url = process.env.NEON_DATABASE_URL_PROD;
if (!url) {
	console.error('NEON_DATABASE_URL_PROD is not set');
	process.exit(1);
}
const sql = neon(url);

// Synthetic 1536-d query vector. Plan SHAPE is independent of the literal values,
// so we avoid burning a Gemini embedding just to read a query plan.
const ZERO_VEC = `[${new Array(1536).fill(0).join(',')}]`;

function hr(title: string) {
	console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`);
}

async function probe(title: string, run: () => Promise<void>) {
	hr(title);
	try {
		await run();
	} catch (e) {
		console.log(`  [skipped/failed] ${(e as Error).message}`);
	}
}

async function explain(label: string, query: string) {
	console.log(`\n--- ${label} ---`);
	const rows = (await sql.query(`EXPLAIN (ANALYZE, BUFFERS, VERBOSE) ${query}`)) as Array<Record<string, string>>;
	for (const r of rows) console.log(`  ${Object.values(r)[0]}`);
}

await probe('CORPUS SIZE (daty P0 scaling gate)', async () => {
	const counts = (await sql.query(`
		SELECT
			(SELECT count(*) FROM rag.chunk) AS chunks,
			(SELECT count(*) FROM rag.chunk WHERE embedding IS NOT NULL) AS chunks_embedded,
			(SELECT count(*) FROM rag.document) AS documents,
			(SELECT count(*) FROM rag.document WHERE status='ready' AND deleted_at IS NULL) AS docs_ready,
			(SELECT count(DISTINCT user_id) FROM rag.document) AS distinct_owners
	`)) as Array<Record<string, number>>;
	console.table(counts);
	const byOwner = (await sql.query(`
		SELECT d.user_id, count(c.id) AS chunks
		FROM rag.chunk c JOIN rag.document d ON d.id = c.document_id
		GROUP BY d.user_id ORDER BY chunks DESC LIMIT 10
	`)) as Array<Record<string, unknown>>;
	console.log('Top owners by chunk count:');
	console.table(byOwner);
});

await probe('HNSW INDEX + iterative_scan GUC (daty P0)', async () => {
	const idx = (await sql.query(`
		SELECT indexname, indexdef FROM pg_indexes
		WHERE schemaname='rag' AND (indexdef ILIKE '%hnsw%' OR indexdef ILIKE '%ivfflat%')
	`)) as Array<Record<string, string>>;
	console.log('Vector indexes:');
	for (const r of idx) console.log(`  ${r.indexname}: ${r.indexdef}`);
	if (!idx.length) console.log('  (none found)');
	const guc = (await sql.query(`SHOW hnsw.iterative_scan`)) as Array<Record<string, string>>;
	console.log(`hnsw.iterative_scan = ${Object.values(guc[0])[0]}`);
	const ef = (await sql.query(`SHOW hnsw.ef_search`)) as Array<Record<string, string>>;
	console.log(`hnsw.ef_search = ${Object.values(ef[0])[0]}`);
});

await probe('TIER-1 VECTOR QUERY — chunk-direct form (daty P0 fix)', async () => {
	// Mirrors the rewritten rawrag/tiers/contextual.ts: filter chunk.user_id directly
	// (no JOIN), so the HNSW index is usable. Want: Index Scan, not Seq Scan + Sort.
	const owners = (await sql.query(
		`SELECT d.user_id, count(c.id) AS n FROM rag.chunk c JOIN rag.document d ON d.id=c.document_id
		 GROUP BY d.user_id ORDER BY n DESC`,
	)) as Array<{ user_id: string; n: number }>;
	const busiest = owners[0]?.user_id;
	const smallest = owners[owners.length - 1]?.user_id;
	for (const [label, owner] of [
		['busiest (non-selective)', busiest],
		['smallest (selective → tests iterative_scan)', smallest],
	] as const) {
		if (!owner) continue;
		await explain(
			`chunk-direct, owner=${label}`,
			`SELECT c.id, c.embedding <=> '${ZERO_VEC}'::vector AS distance
			 FROM rag.chunk c
			 WHERE c.user_id = '${owner}' AND c.embedding IS NOT NULL
			 ORDER BY c.embedding <=> '${ZERO_VEC}'::vector LIMIT 5`,
		);
	}
});

await probe('BRAND_SETTINGS default row (sys Finding 1 severity gate)', async () => {
	const rows = (await sql.query(`SELECT id, enabled FROM app.brand_settings WHERE id='default'`)) as Array<
		Record<string, unknown>
	>;
	if (!rows.length) {
		console.log(
			'  ⚠ NO default row → getBrandConfig() null-cache bug fires a Neon SELECT on EVERY request. sys Finding 1 is LIVE P0.',
		);
	} else {
		console.log(`  default row EXISTS (enabled=${rows[0].enabled}) → null-cache bug is latent, not live.`);
		console.table(rows);
	}
});

await probe('BLOG listPosts revision over-fetch (daty P1)', async () => {
	const counts = (await sql.query(`
		SELECT (SELECT count(*) FROM blog.post) AS posts,
		       (SELECT count(*) FROM blog.revision) AS revisions,
		       round((SELECT count(*) FROM blog.revision)::numeric /
		             nullif((SELECT count(*) FROM blog.post),0), 1) AS revisions_per_post
	`)) as Array<Record<string, unknown>>;
	console.table(counts);
	const ids = (await sql.query(`SELECT id FROM blog.post ORDER BY created_at DESC LIMIT 20`)) as Array<{ id: string }>;
	if (ids.length) {
		const inList = ids.map((r) => `'${r.id}'`).join(',');
		await explain(
			'current: revisions for 20 posts, no LIMIT (app dedups)',
			`SELECT post_id, title, summary FROM blog.revision
			 WHERE post_id IN (${inList}) ORDER BY created_at DESC`,
		);
	}
});

console.log('\nDone.\n');
