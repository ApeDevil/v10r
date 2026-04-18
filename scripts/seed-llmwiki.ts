/**
 * llmwiki dogfood seed.
 *
 * Inserts a tiny ingest-compatible fixture into rag.*:
 *   - one rag.document (user-owned)
 *   - three rag.chunk rows (embedded via google-gemini-embedding-001)
 *   - one llmwiki_page (kind='overview') per collection scope (global, null)
 *   - two llmwiki_page (kind='page') with embeddings + populated search_vector
 *   - three llmwiki_page_source rows linking pages to chunks
 *
 * Idempotent: deletes the existing fixture rows (by stable ID prefix) before
 * re-inserting. Run INSIDE the v10r container — host has no node_modules:
 *
 *   podman exec -it v10r bun run scripts/seed-llmwiki.ts <userId>
 *
 * If userId is omitted, picks the first user in the `user` table. For
 * production you obviously pass an explicit one.
 */

import { createHash } from 'node:crypto';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { neonConfig, Pool } from '@neondatabase/serverless';
import { embed, embedMany } from 'ai';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';

neonConfig.poolQueryViaFetch = true;

const DATABASE_URL = process.env.DATABASE_URL;
const GEMINI_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!DATABASE_URL) {
	console.error('DATABASE_URL not set');
	process.exit(1);
}
if (!GEMINI_KEY) {
	console.error('GOOGLE_GENERATIVE_AI_API_KEY not set');
	process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);
const embedModel = createGoogleGenerativeAI({ apiKey: GEMINI_KEY }).embedding('gemini-embedding-001');
const EMBEDDING_OPTS = { google: { outputDimensionality: 1536 } };

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);
const vecLiteral = (v: number[]) => `[${v.join(',')}]`;

const DOC_ID = 'doc_seed_wiki_demo';
const CHK_IDS = ['chk_seed_rrf', 'chk_seed_hnsw', 'chk_seed_bm25'];
const PAGE_OVERVIEW = 'lwp_seed_overview';
const PAGE_RETRIEVAL = 'lwp_seed_retrieval';
const PAGE_EMBEDDINGS = 'lwp_seed_embeddings';

const CHUNKS = [
	{
		id: CHK_IDS[0],
		content:
			'Reciprocal Rank Fusion (RRF) combines multiple ranked result lists by summing 1/(k+rank) across lists for each unique item. The constant k (typically 60) dampens the influence of top ranks, making RRF robust to score distributions across heterogeneous retrievers.',
	},
	{
		id: CHK_IDS[1],
		content:
			'HNSW (Hierarchical Navigable Small World) is a graph-based approximate nearest neighbor index. It builds a multi-layer proximity graph where upper layers are sparse shortcuts. Query time is logarithmic in the dataset size, and recall is tuned via the `ef` parameter at search time.',
	},
	{
		id: CHK_IDS[2],
		content:
			'BM25 is the classic probabilistic ranking function in full-text search. It scores a document by summing per-term contributions that depend on term frequency, inverse document frequency, and document length normalization (with parameters k1 ≈ 1.2 and b ≈ 0.75 in most tunings).',
	},
];

const OVERVIEW_TEXT = {
	slug: 'overview',
	title: 'Retrieval Primer',
	tldr: 'A short map of the three retrieval techniques: hybrid fusion (RRF), vector ANN (HNSW), and lexical scoring (BM25).',
	body: '# Retrieval Primer\n\nThis collection covers the three classical retrieval primitives used in the chat pipeline: RRF for fusing ranked lists, HNSW for fast approximate vector search, and BM25 for lexical ranking. Each page carries pointers to the underlying source chunk.',
	tags: ['retrieval', 'overview'],
};

const PAGES = [
	{
		id: PAGE_RETRIEVAL,
		slug: 'reciprocal-rank-fusion',
		title: 'Reciprocal Rank Fusion',
		tldr: 'RRF fuses ranked lists by summing 1/(k+rank) across retrievers. Robust to score-scale differences; k≈60.',
		body: '# Reciprocal Rank Fusion\n\nRRF is the standard way to combine results from multiple retrievers when scores are not directly comparable. For each document, sum `1 / (k + rank_i)` over the retrievers that returned it. `k` is a smoothing constant (60 is common). RRF is robust to heterogeneous score distributions because it only uses ranks.',
		tags: ['retrieval', 'rrf', 'fusion'],
		chunkId: CHK_IDS[0],
	},
	{
		id: PAGE_EMBEDDINGS,
		slug: 'hnsw-vs-bm25',
		title: 'HNSW vs BM25',
		tldr: 'HNSW indexes vectors for semantic ANN; BM25 scores documents lexically. Complementary — fuse them.',
		body: '# HNSW vs BM25\n\nHNSW is a graph-based approximate nearest neighbor index, with logarithmic query time and tunable recall via `ef`. BM25 is a TF-IDF-style lexical scoring function. They complement each other: HNSW catches paraphrase, BM25 catches exact-term matches (IDs, codes, rare terms). Combine via RRF for best results.',
		tags: ['retrieval', 'hnsw', 'bm25'],
		chunkId: CHK_IDS[1],
	},
];

async function resolveUserId(): Promise<string> {
	const cliUser = process.argv[2];
	if (cliUser) return cliUser;
	const row = await db.execute<{ id: string }>(sql`SELECT id FROM auth."user" LIMIT 1`);
	const id = row.rows[0]?.id;
	if (!id) throw new Error('No users in DB; pass a userId as argv[2]');
	return id;
}

async function embedOne(text: string): Promise<number[]> {
	const r = await embed({ model: embedModel, value: text, providerOptions: EMBEDDING_OPTS });
	return r.embedding;
}

async function embedMany_(texts: string[]): Promise<number[][]> {
	const r = await embedMany({ model: embedModel, values: texts, providerOptions: EMBEDDING_OPTS });
	return r.embeddings;
}

async function deleteExisting() {
	console.log('[seed:llmwiki] Removing previous fixture rows...');
	await db.execute(sql`DELETE FROM rag.llmwiki_page_source WHERE llmwiki_page_id LIKE 'lwp_seed_%'`);
	await db.execute(sql`DELETE FROM rag.llmwiki_page WHERE id LIKE 'lwp_seed_%'`);
	await db.execute(sql`DELETE FROM rag.chunk WHERE id LIKE 'chk_seed_%'`);
	await db.execute(sql`DELETE FROM rag.document WHERE id = ${DOC_ID}`);
}

async function insertDocumentAndChunks(userId: string) {
	console.log('[seed:llmwiki] Inserting document + chunks...');
	const docHash = hash(CHUNKS.map((c) => c.content).join('\n\n'));
	await db.execute(sql`
		INSERT INTO rag.document (id, user_id, title, source, status, total_chunks, total_tokens, content_hash)
		VALUES (${DOC_ID}, ${userId}, 'Retrieval Primer Source', 'text', 'ready', ${CHUNKS.length}, 600, ${docHash})
	`);

	const chunkEmbeddings = await embedMany_(CHUNKS.map((c) => c.content));
	for (let i = 0; i < CHUNKS.length; i++) {
		const c = CHUNKS[i];
		await db.execute(sql`
			INSERT INTO rag.chunk (
				id, document_id, level, position, content, token_count, content_hash,
				embedding_model_id, embedding
			)
			VALUES (
				${c.id}, ${DOC_ID}, 'paragraph', ${i}, ${c.content}, ${Math.ceil(c.content.length / 4)},
				${hash(c.content)}, 'google-gemini-embedding-001', ${vecLiteral(chunkEmbeddings[i])}::vector
			)
		`);
	}
}

async function insertLlmwikiPages(userId: string) {
	console.log('[seed:llmwiki] Inserting overview + wiki pages...');

	const overviewEmbed = await embedOne(
		`${OVERVIEW_TEXT.title}\n${OVERVIEW_TEXT.tldr}\n${OVERVIEW_TEXT.tags.join(' ')}`,
	);
	await db.execute(sql`
		INSERT INTO rag.llmwiki_page (
			id, user_id, collection_id, slug, kind, title, tldr, tldr_hash, body, tags,
			frontmatter, embedding, search_vector, source_hash, source_count,
			compiled_at, compiled_by_model, stale
		)
		VALUES (
			${PAGE_OVERVIEW}, ${userId}, NULL, ${OVERVIEW_TEXT.slug}, 'overview',
			${OVERVIEW_TEXT.title}, ${OVERVIEW_TEXT.tldr}, ${hash(OVERVIEW_TEXT.tldr)},
			${OVERVIEW_TEXT.body}, ${`{${OVERVIEW_TEXT.tags.join(',')}}`}::text[], '{}'::jsonb,
			${vecLiteral(overviewEmbed)}::vector,
			to_tsvector('english',
				${OVERVIEW_TEXT.title} || ' ' || ${OVERVIEW_TEXT.tldr} || ' ' ||
				${OVERVIEW_TEXT.body} || ' ' || ${OVERVIEW_TEXT.tags.join(' ')}
			),
			${hash(OVERVIEW_TEXT.body)}, 0, now(), 'seed', false
		)
	`);

	const pageEmbeds = await embedMany_(PAGES.map((p) => `${p.title}\n${p.tldr}\n${p.tags.join(' ')}`));
	for (let i = 0; i < PAGES.length; i++) {
		const p = PAGES[i];
		await db.execute(sql`
			INSERT INTO rag.llmwiki_page (
				id, user_id, collection_id, slug, kind, title, tldr, tldr_hash, body, tags,
				frontmatter, embedding, search_vector, source_hash, source_count,
				compiled_at, compiled_by_model, stale
			)
			VALUES (
				${p.id}, ${userId}, NULL, ${p.slug}, 'page',
				${p.title}, ${p.tldr}, ${hash(p.tldr)},
				${p.body}, ${`{${p.tags.join(',')}}`}::text[], '{}'::jsonb,
				${vecLiteral(pageEmbeds[i])}::vector,
				to_tsvector('english',
					${p.title} || ' ' || ${p.tldr} || ' ' ||
					${p.body} || ' ' || ${p.tags.join(' ')}
				),
				${hash(p.body)}, 1, now(), 'seed', false
			)
		`);
	}
}

async function insertPageSources() {
	console.log('[seed:llmwiki] Linking pages to source chunks...');
	for (const p of PAGES) {
		const chunkContent = CHUNKS.find((c) => c.id === p.chunkId)?.content ?? '';
		await db.execute(sql`
			INSERT INTO rag.llmwiki_page_source (
				llmwiki_page_id, chunk_id, document_id, weight, source_hash_at_compile
			)
			VALUES (${p.id}, ${p.chunkId}, ${DOC_ID}, 1.0, ${hash(chunkContent)})
		`);
	}

	// Extra source rows: the RRF page also cites the other two chunks at lower weight
	// (so we can exercise pointer hydration's weight-desc ordering + cap).
	for (let i = 1; i < CHUNKS.length; i++) {
		const c = CHUNKS[i];
		await db.execute(sql`
			INSERT INTO rag.llmwiki_page_source (
				llmwiki_page_id, chunk_id, document_id, weight, source_hash_at_compile
			)
			VALUES (${PAGE_RETRIEVAL}, ${c.id}, ${DOC_ID}, ${0.5 - i * 0.1}, ${hash(c.content)})
		`);
	}
}

async function main() {
	const userId = await resolveUserId();
	console.log(`[seed:llmwiki] Seeding for user ${userId}`);
	await deleteExisting();
	await insertDocumentAndChunks(userId);
	await insertLlmwikiPages(userId);
	await insertPageSources();
	console.log(`[seed:llmwiki] Done. 1 doc, ${CHUNKS.length} chunks, ${PAGES.length + 1} wiki pages.`);
	console.log(`[seed:llmwiki] Try a query: "how does RRF work?" with useLlmwiki=true.`);
	await pool.end();
}

main().catch((err) => {
	console.error('[seed:llmwiki] Failed:', err);
	process.exit(1);
});
