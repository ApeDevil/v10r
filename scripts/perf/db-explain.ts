#!/usr/bin/env bun
/**
 * DB performance probe — confirms the static-review findings against the real database.
 *
 * Runs read-only diagnostics (counts, EXPLAIN ANALYZE, GUC checks) so we measure
 * actual query plans + data-volume instead of guessing. Safe: every statement is a
 * SELECT / EXPLAIN / SHOW — no mutations.
 *
 * Usage (from host, via the container so env + node_modules are present):
 *   podman compose run --rm --entrypoint bun app run scripts/perf/db-explain.ts
 *
 * Targets NEON_DATABASE_URL_PROD (the real corpus). Each probe is independently
 * try/caught so one failure never aborts the rest.
 *
 * It also MEASURES `vector_query_ms`. That budget sat in budgets.json with nothing
 * producing a number for it, which is the weakest kind of budget — one that can never be
 * missed. The figure comes free: `EXPLAIN ANALYZE` already reports the executor's own
 * `Execution Time`, so scoring it costs one regex and burns neither an embedding nor an
 * extra query. The verdict is REPORTED, not enforced: this probe runs by hand against a
 * shared serverless database, and a target that fails a build because Neon was cold is a
 * target nobody keeps.
 */
import { neon } from '@neondatabase/serverless';
import { budgets, scoreBudget } from '$lib/server/perf/budgets';

const url = process.env.NEON_DATABASE_URL_PROD;
if (!url) {
	console.error('NEON_DATABASE_URL_PROD is not set');
	process.exit(1);
}
const sql = neon(url);

/**
 * The query vector is a stored embedding (any chunk's), never a Gemini call. The plan
 * SHAPE would survive a synthetic vector, but the milliseconds would not: cosine
 * distance to the zero vector is NaN, which turns an HNSW walk into a random one.
 */
async function queryVector(): Promise<string> {
	const rows = (await sql.query(
		`SELECT embedding::text AS v FROM retrieval.chunk WHERE embedding IS NOT NULL LIMIT 1`,
	)) as Array<{ v: string }>;
	return rows[0]?.v ?? `[${new Array(1536).fill(0).join(',')}]`;
}

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

async function explain(label: string, query: string): Promise<string[]> {
	console.log(`\n--- ${label} ---`);
	const rows = (await sql.query(`EXPLAIN (ANALYZE, BUFFERS, VERBOSE) ${query}`)) as Array<Record<string, string>>;
	const plan = rows.map((r) => String(Object.values(r)[0]));
	for (const line of plan) console.log(`  ${line}`);
	return plan;
}

/** The executor's own timing, in ms. `null` when the plan did not report one. */
function executionMs(plan: string[]): number | null {
	const line = plan.find((l) => l.startsWith('Execution Time:'));
	const ms = line ? Number.parseFloat(line.replace('Execution Time:', '')) : Number.NaN;
	return Number.isFinite(ms) ? ms : null;
}

/**
 * A vector query that fell back to a sequential scan is not a slow query, it is an
 * unused index — and the difference is the whole reason this probe exists.
 */
/**
 * How the planner reached the rows. A vector-index walk is the plan the non-selective owner
 * needs; for an owner with a handful of chunks the planner rightly prefers the `user_id`
 * btree plus an in-memory sort (pgvector's iterative scan is for the middle ground), so
 * only a sequential scan is the finding.
 */
function accessPathOf(plan: string[]): 'vector index' | 'owner index + sort' | 'SEQ SCAN' {
	if (plan.some((l) => /Index Scan using .*(hnsw|embedding)/i.test(l))) return 'vector index';
	if (plan.some((l) => /Index Scan using chunk_user_idx/.test(l))) return 'owner index + sort';
	return 'SEQ SCAN';
}

const vectorMeasurements: Array<{ label: string; ms: number; path: ReturnType<typeof accessPathOf> }> = [];

await probe('CORPUS SIZE (daty P0 scaling gate)', async () => {
	const counts = (await sql.query(`
		SELECT
			(SELECT count(*) FROM retrieval.chunk) AS chunks,
			(SELECT count(*) FROM retrieval.chunk WHERE embedding IS NOT NULL) AS chunks_embedded,
			(SELECT count(*) FROM retrieval.document) AS documents,
			(SELECT count(*) FROM retrieval.document WHERE status='ready' AND deleted_at IS NULL) AS docs_ready,
			(SELECT count(DISTINCT user_id) FROM retrieval.document) AS distinct_owners
	`)) as Array<Record<string, number>>;
	console.table(counts);
	const byOwner = (await sql.query(`
		SELECT d.user_id, count(c.id) AS chunks
		FROM retrieval.chunk c JOIN retrieval.document d ON d.id = c.document_id
		GROUP BY d.user_id ORDER BY chunks DESC LIMIT 10
	`)) as Array<Record<string, unknown>>;
	console.log('Top owners by chunk count:');
	console.table(byOwner);
});

await probe('HNSW INDEX + iterative_scan GUC (daty P0)', async () => {
	const idx = (await sql.query(`
		SELECT indexname, indexdef FROM pg_indexes
		WHERE schemaname='retrieval' AND (indexdef ILIKE '%hnsw%' OR indexdef ILIKE '%ivfflat%')
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
	// Mirrors the rewritten retrieval/tiers/contextual.ts: filter chunk.user_id directly
	// (no JOIN), so the HNSW index is usable. Want: Index Scan, not Seq Scan + Sort.
	const owners = (await sql.query(
		`SELECT d.user_id, count(c.id) AS n FROM retrieval.chunk c JOIN retrieval.document d ON d.id=c.document_id
		 GROUP BY d.user_id ORDER BY n DESC`,
	)) as Array<{ user_id: string; n: number }>;
	const busiest = owners[0]?.user_id;
	const smallest = owners[owners.length - 1]?.user_id;
	const vec = await queryVector();
	for (const [label, owner] of [
		['busiest (non-selective)', busiest],
		['smallest (selective → tests iterative_scan)', smallest],
	] as const) {
		if (!owner) continue;
		const plan = await explain(
			`chunk-direct, owner=${label}`,
			`SELECT c.id, c.embedding <=> '${vec}'::vector AS distance
			 FROM retrieval.chunk c
			 WHERE c.user_id = '${owner}' AND c.embedding IS NOT NULL
			 ORDER BY c.embedding <=> '${vec}'::vector LIMIT 5`,
		);
		const ms = executionMs(plan);
		if (ms !== null) vectorMeasurements.push({ label, ms, path: accessPathOf(plan) });
	}
});

await probe('DESKBOT VECTOR QUERY — the source-scoped lane (retrieval/tiers/source-scope.ts)', async () => {
	// The deskbot's `desk_search_knowledge` adds a semi-join on `retrieval.document` to the
	// tier-1 shape above (`source = 'desk' AND deleted_at IS NULL`). The chatbot lane is the
	// unscoped query; this one has to keep the index walk too, or every desk search pays a
	// sequential scan the chatbot never sees.
	const owners = (await sql.query(
		`SELECT d.user_id, count(c.id) AS n FROM retrieval.chunk c JOIN retrieval.document d ON d.id=c.document_id
		 WHERE d.source = 'desk' AND d.deleted_at IS NULL GROUP BY d.user_id ORDER BY n DESC LIMIT 1`,
	)) as Array<{ user_id: string; n: number }>;
	const owner = owners[0]?.user_id;
	if (!owner) {
		console.log('  no desk documents ingested — nothing to explain');
		return;
	}
	const vec = await queryVector();
	const plan = await explain(
		'desk-scoped, busiest desk owner',
		`SELECT c.id, c.embedding <=> '${vec}'::vector AS distance
		 FROM retrieval.chunk c
		 WHERE c.user_id = '${owner}' AND c.embedding IS NOT NULL
		   AND c.document_id IN (SELECT d.id FROM retrieval.document d WHERE d.user_id = '${owner}' AND d.source = 'desk' AND d.deleted_at IS NULL)
		 ORDER BY c.embedding <=> '${vec}'::vector LIMIT 10`,
	);
	const ms = executionMs(plan);
	if (ms !== null) vectorMeasurements.push({ label: 'desk-scoped lane', ms, path: accessPathOf(plan) });
});

await probe('BLOG listPosts latest-revision read (query budget: blog.listPosts)', async () => {
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
		// The shape `listPosts` actually issues today. It used to read every revision of
		// every post and de-duplicate in JS — unbounded in edits × locales — so this probe
		// exists to confirm the DISTINCT ON form reaches the composite index instead of
		// sorting the whole table. `query-budget.gate.pglite.test.ts` proves the COUNT is
		// flat; only a plan can say whether the one query is cheap.
		await explain(
			'latest revision per post, DISTINCT ON over 20 ids',
			`SELECT DISTINCT ON (post_id) post_id, title, summary FROM blog.revision
			 WHERE post_id IN (${inList}) ORDER BY post_id, created_at DESC`,
		);
	}
});

hr('VECTOR QUERY BUDGET (vector_query_ms)');
if (vectorMeasurements.length === 0) {
	console.log('  no vector query completed — nothing to score');
} else {
	const budget = budgets.vector_query_ms;
	console.log(`  budget: warn >${budget.warn}ms, fail >${budget.fail}ms — ${budget.note}`);
	for (const m of vectorMeasurements) {
		const verdict = scoreBudget('vector_query_ms', m.ms);
		const path = m.path === 'SEQ SCAN' ? 'SEQ SCAN — this is the finding, not the milliseconds' : m.path;
		console.log(`  ${verdict.toUpperCase().padEnd(5)} ${m.ms.toFixed(1)}ms  ${m.label}  (${path})`);
	}
	// Reported, never enforced — see the header. A hand-run probe against a serverless
	// database that suspends after five minutes cannot own a build's exit code.
	console.log('  reported only; nothing here fails a build');
}

console.log('\nDone.\n');
