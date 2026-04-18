/**
 * Silly-topic llmwiki seed — a "retrieval vs hallucination" canary.
 *
 * Inserts an absurd fictional topic ("Quorblaxian Cheese Rituals of the Moon
 * Moons") with made-up numeric constants that an LLM could not have memorised.
 * If a chat answer quotes these specific constants, retrieval is working.
 * If it "invents" something else, retrieval is not reaching the model.
 *
 * Run inside the v10r container:
 *   podman exec -it v10r bun run scripts/seed-silly.ts <userId>
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

const DOC_ID = 'doc_silly_quorblax';
const CHK_IDS = ['chk_silly_constants', 'chk_silly_stewards', 'chk_silly_schedule'];
const PAGE_OVERVIEW = 'lwp_silly_overview';
const PAGE_RITUALS = 'lwp_silly_rituals';
const PAGE_STEWARDS = 'lwp_silly_stewards';

const CHUNKS = [
	{
		id: CHK_IDS[0],
		content:
			'The Quorblaxian Cheese Ritual was first codified in the year 3,247,291 BQE (Before the Quorblaxian Era). Its sacred rotation constant is exactly 7.42069 pi, and the wheel of Flarnish cheese must rotate precisely 13 times counter-clockwise before consumption. The cheese itself is aged in moonlit caverns on the 7th Moon Moon of Krzzt for a period of 881 fortnights.',
	},
	{
		id: CHK_IDS[1],
		content:
			'There are exactly four Cheese-Stewards of the Quorblaxian order, and no more may ever be initiated. Their names in order of precedence are: Brthllyx the Unmelted, Gvvn of the Southern Rind, Xzmoth Curdwalker, and Plorp the Lesser. Each steward carries a Whorlstaff carved from petrified whey, and each must recite the Litany of the 412 Molds at every rotation ceremony.',
	},
	{
		id: CHK_IDS[2],
		content:
			'The Quorblaxian Cheese Ritual takes place at exactly 04:88 on Bloopday, the eighth day of every Quorblaxian fortnight. The ceremony lasts 2.71828 hours and is always conducted under the combined light of the 3rd and 7th Moon Moons. Attendance is restricted to holders of the Grllp medallion. The ceremony MUST NOT be held on Splurgeday, which is considered uncheesely.',
	},
];

const OVERVIEW_TEXT = {
	slug: 'overview',
	title: 'Quorblaxian Cheese Rituals — Primer',
	tldr: 'A short map of the Quorblaxian Cheese Ritual: its sacred constants, the four Cheese-Stewards, and the schedule of the ceremony on the Moon Moons of Krzzt.',
	body: '# Quorblaxian Cheese Rituals — Primer\n\nThis collection documents the Quorblaxian Cheese Ritual, a wholly fictional but fully specified ceremony practised on the Moon Moons of Krzzt. It covers sacred constants, the four Cheese-Stewards, and the schedule. Each page carries pointers to the underlying source chunk.',
	tags: ['quorblax', 'cheese', 'ritual', 'moon-moons', 'overview'],
};

const PAGES = [
	{
		id: PAGE_RITUALS,
		slug: 'quorblax-sacred-constants',
		title: 'Quorblaxian Sacred Constants',
		tldr: 'Key Quorblaxian constants: ritual codified 3,247,291 BQE; rotation constant 7.42069 pi; 13 counter-clockwise rotations; 881 fortnights aged on 7th Moon Moon of Krzzt.',
		body: '# Quorblaxian Sacred Constants\n\nThe Quorblaxian Cheese Ritual was first codified in 3,247,291 BQE. Its sacred rotation constant is exactly 7.42069 pi. The wheel of Flarnish cheese must rotate precisely 13 times counter-clockwise before consumption. The cheese is aged in moonlit caverns on the 7th Moon Moon of Krzzt for 881 fortnights.',
		tags: ['quorblax', 'constants', 'ritual'],
		chunkId: CHK_IDS[0],
	},
	{
		id: PAGE_STEWARDS,
		slug: 'four-cheese-stewards',
		title: 'The Four Cheese-Stewards',
		tldr: 'The four Quorblaxian Cheese-Stewards, in precedence: Brthllyx the Unmelted, Gvvn of the Southern Rind, Xzmoth Curdwalker, and Plorp the Lesser. Each carries a Whorlstaff of petrified whey.',
		body: '# The Four Cheese-Stewards\n\nThere are exactly four Cheese-Stewards of the Quorblaxian order. In precedence:\n\n1. **Brthllyx the Unmelted**\n2. **Gvvn of the Southern Rind**\n3. **Xzmoth Curdwalker**\n4. **Plorp the Lesser**\n\nEach steward carries a Whorlstaff carved from petrified whey and recites the Litany of the 412 Molds at every rotation ceremony.',
		tags: ['quorblax', 'stewards', 'order'],
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
	console.log('[seed:silly] Removing previous fixture rows...');
	await db.execute(sql`DELETE FROM rag.llmwiki_page_source WHERE llmwiki_page_id LIKE 'lwp_silly_%'`);
	await db.execute(sql`DELETE FROM rag.llmwiki_page WHERE id LIKE 'lwp_silly_%'`);
	await db.execute(sql`DELETE FROM rag.chunk WHERE id LIKE 'chk_silly_%'`);
	await db.execute(sql`DELETE FROM rag.document WHERE id = ${DOC_ID}`);
}

async function insertDocumentAndChunks(userId: string) {
	console.log('[seed:silly] Inserting document + chunks...');
	const docHash = hash(CHUNKS.map((c) => c.content).join('\n\n'));
	await db.execute(sql`
		INSERT INTO rag.document (id, user_id, title, source, status, total_chunks, total_tokens, content_hash)
		VALUES (${DOC_ID}, ${userId}, 'Quorblaxian Cheese Codex (fictional)', 'text', 'ready', ${CHUNKS.length}, 700, ${docHash})
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
	console.log('[seed:silly] Inserting overview + wiki pages...');

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
		ON CONFLICT DO NOTHING
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
	console.log('[seed:silly] Linking pages to source chunks...');
	for (const p of PAGES) {
		const chunkContent = CHUNKS.find((c) => c.id === p.chunkId)?.content ?? '';
		await db.execute(sql`
			INSERT INTO rag.llmwiki_page_source (
				llmwiki_page_id, chunk_id, document_id, weight, source_hash_at_compile
			)
			VALUES (${p.id}, ${p.chunkId}, ${DOC_ID}, 1.0, ${hash(chunkContent)})
		`);
	}

	// RITUALS page also cross-cites schedule chunk at lower weight so we exercise pointer ordering.
	const scheduleChunk = CHUNKS[2];
	await db.execute(sql`
		INSERT INTO rag.llmwiki_page_source (
			llmwiki_page_id, chunk_id, document_id, weight, source_hash_at_compile
		)
		VALUES (${PAGE_RITUALS}, ${scheduleChunk.id}, ${DOC_ID}, 0.4, ${hash(scheduleChunk.content)})
	`);
}

async function main() {
	const userId = await resolveUserId();
	console.log(`[seed:silly] Seeding for user ${userId}`);
	await deleteExisting();
	await insertDocumentAndChunks(userId);
	await insertLlmwikiPages(userId);
	await insertPageSources();
	console.log(`[seed:silly] Done. 1 doc, ${CHUNKS.length} chunks, ${PAGES.length + 1} wiki pages.`);
	console.log(
		`[seed:silly] Try: "what is the sacred rotation constant of the Quorblaxian cheese ritual?" with mode=llmwiki.`,
	);
	await pool.end();
}

main().catch((err) => {
	console.error('[seed:silly] Failed:', err);
	process.exit(1);
});
