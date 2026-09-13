/**
 * One-time DDL for the llmwiki retirement (Phase 4 of docs/ai-ref-plan.md, decision D8):
 * the pointer layer is gone, and the one row it still served — the project docs
 * overview — becomes `retrieval.corpus_map`.
 *
 * drizzle-kit sees a rename as a DROP plus a CREATE, which would discard that row and
 * prompt for the choice. `ALTER … RENAME` carries it across. Each step is guarded and
 * idempotent — a partial run is safe to repeat:
 *   1. `retrieval.llmwiki_page_source` is dropped — nothing reads pointers any more
 *   2. `kind = 'page'` rows are deleted: the map table holds maps only
 *   3. table `retrieval.llmwiki_page` → `retrieval.corpus_map`, `compiled_at` → `built_at`,
 *      the wiki-only columns dropped, the wiki indexes dropped, `collection_id` NOT NULL
 *   4. enum `retrieval.llmwiki_page_kind` is dropped once no column uses it
 *
 * Run this BEFORE `db:push`; afterwards push must offer nothing for `llmwiki_page` and no
 * rename prompt — only the two `corpus_map` indexes, at most. If it offers to create
 * `corpus_map` or drop `llmwiki_page`, stop and investigate rather than accepting.
 *
 *   podman exec v10r bun run db:rename-llmwiki-page
 */
import { neonConfig, Pool } from '@neondatabase/serverless';

neonConfig.poolQueryViaFetch = true;

const connectionString = process.env.NEON_DATABASE_URL_PROD;
if (!connectionString) {
	console.error('NEON_DATABASE_URL_PROD not set');
	process.exit(1);
}

const pool = new Pool({ connectionString });

async function tableExists(schema: string, name: string): Promise<boolean> {
	const { rows } = await pool.query(
		'SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
		[schema, name],
	);
	return rows.length > 0;
}

async function columnExists(schema: string, table: string, column: string): Promise<boolean> {
	const { rows } = await pool.query(
		'SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3',
		[schema, table, column],
	);
	return rows.length > 0;
}

async function enumExists(schema: string, name: string): Promise<boolean> {
	const { rows } = await pool.query(
		`SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
		 WHERE n.nspname = $1 AND t.typname = $2 AND t.typtype = 'e'`,
		[schema, name],
	);
	return rows.length > 0;
}

/** Rename `from` → `to` when only `from` exists; refuse when both do. */
async function renameGuarded(label: string, hasFrom: boolean, hasTo: boolean, ddl: string): Promise<boolean> {
	if (!hasFrom && hasTo) {
		console.log(`  ${label}: already renamed.`);
		return true;
	}
	if (!hasFrom && !hasTo) {
		console.error(`  ${label}: neither name exists. Refusing to guess — run db:push on a fresh database instead.`);
		return false;
	}
	if (hasFrom && hasTo) {
		console.error(`  ${label}: BOTH names exist. A previous run was interrupted, or a db:push created the new`);
		console.error('    one empty. Inspect both and merge by hand — this script will not choose.');
		return false;
	}
	await pool.query(ddl);
	console.log(`  ${label}: renamed.`);
	return true;
}

/** Everything a wiki page carried that a corpus map does not. */
const WIKI_COLUMNS = [
	'slug',
	'kind',
	'tldr',
	'tldr_hash',
	'tags',
	'frontmatter',
	'embedding',
	'search_vector',
	'source_hash',
	'source_count',
	'compiled_by_model',
	'stale',
	'deleted_at',
	'created_at',
	'updated_at',
];

const WIKI_INDEXES = [
	'llmwiki_page_slug_uq',
	'llmwiki_overview_uq',
	'llmwiki_page_user_idx',
	'llmwiki_page_collection_idx',
	'llmwiki_page_stale_idx',
	'llmwiki_page_embed_idx',
	'llmwiki_page_fts_idx',
];

let ok = true;
try {
	console.log('1. table retrieval.llmwiki_page_source');
	if (await tableExists('retrieval', 'llmwiki_page_source')) {
		await pool.query('DROP TABLE retrieval.llmwiki_page_source');
		console.log('  dropped.');
	} else {
		console.log('  already gone.');
	}

	console.log('2. rows: maps only');
	if ((await tableExists('retrieval', 'llmwiki_page')) && (await columnExists('retrieval', 'llmwiki_page', 'kind'))) {
		const { rowCount } = await pool.query("DELETE FROM retrieval.llmwiki_page WHERE kind <> 'overview'");
		console.log(`  ${rowCount ?? 0} wiki page row(s) deleted.`);
		const orphans = await pool.query('DELETE FROM retrieval.llmwiki_page WHERE collection_id IS NULL');
		if (orphans.rowCount) console.log(`  ${orphans.rowCount} collection-less overview row(s) deleted.`);
	} else {
		console.log('  nothing to prune.');
	}

	console.log('3. table retrieval.llmwiki_page → retrieval.corpus_map');
	ok =
		(await renameGuarded(
			'retrieval.llmwiki_page → retrieval.corpus_map',
			await tableExists('retrieval', 'llmwiki_page'),
			await tableExists('retrieval', 'corpus_map'),
			'ALTER TABLE retrieval.llmwiki_page RENAME TO corpus_map',
		)) && ok;

	if (ok && (await tableExists('retrieval', 'corpus_map'))) {
		ok =
			(await renameGuarded(
				'column compiled_at → built_at',
				await columnExists('retrieval', 'corpus_map', 'compiled_at'),
				await columnExists('retrieval', 'corpus_map', 'built_at'),
				'ALTER TABLE retrieval.corpus_map RENAME COLUMN compiled_at TO built_at',
			)) && ok;

		for (const name of WIKI_INDEXES) {
			const { rows } = await pool.query('SELECT 1 FROM pg_indexes WHERE schemaname = $1 AND indexname = $2', [
				'retrieval',
				name,
			]);
			if (rows.length > 0) {
				await pool.query(`DROP INDEX retrieval.${name}`);
				console.log(`  index ${name}: dropped.`);
			}
		}

		for (const column of WIKI_COLUMNS) {
			if (await columnExists('retrieval', 'corpus_map', column)) {
				await pool.query(`ALTER TABLE retrieval.corpus_map DROP COLUMN ${column}`);
				console.log(`  column ${column}: dropped.`);
			}
		}

		await pool.query('ALTER TABLE retrieval.corpus_map ALTER COLUMN collection_id SET NOT NULL');
		await pool.query('ALTER TABLE retrieval.corpus_map ALTER COLUMN built_at SET DEFAULT now()');
		console.log('  collection_id NOT NULL, built_at default now().');
	}

	console.log('4. enum retrieval.llmwiki_page_kind');
	if (await enumExists('retrieval', 'llmwiki_page_kind')) {
		await pool.query('DROP TYPE retrieval.llmwiki_page_kind');
		console.log('  dropped.');
	} else {
		console.log('  already gone.');
	}
} finally {
	await pool.end();
}

if (!ok) process.exit(1);
console.log(
	'\nDone. Now run `db:push` — it must offer nothing for retrieval.llmwiki_page and no rename prompt; the two corpus_map indexes are the most it should add.',
);
