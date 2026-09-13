/**
 * Silly-topic retrieval seed — a "retrieval vs hallucination" canary.
 *
 * Inserts an absurd fictional topic ("Quorblaxian Cheese Rituals of the Moon
 * Moons") with made-up numeric constants that an LLM could not have memorised, as one
 * user-owned document with three embedded chunks. If a chat answer quotes these specific
 * constants, retrieval is working. If it "invents" something else, retrieval is not
 * reaching the model.
 *
 * Run inside the v10r container:
 *   podman exec -it v10r bun run scripts/db/seed-silly.ts <userId>
 */

import { createHash } from 'node:crypto';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { neonConfig, Pool } from '@neondatabase/serverless';
import { embedMany } from 'ai';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { EMBEDDING_UNAVAILABLE_MESSAGES, resolveEmbeddingConnection } from '../../src/lib/server/ai/connections';
import { listProviderConnections } from '../../src/lib/server/db/ai/provider-connections';
import * as schema from '../../src/lib/server/db/schema';
import {
	EMBEDDING_DIMENSIONS,
	EMBEDDING_MODEL,
	EMBEDDING_MODEL_ID,
} from '../../src/lib/server/retrieval-shared/embed-config';

neonConfig.poolQueryViaFetch = true;

const SCRIPT_NAME = 'seed-silly';
const NEON_DATABASE_URL_PROD = process.env.NEON_DATABASE_URL_PROD;
if (!NEON_DATABASE_URL_PROD) {
	console.error('NEON_DATABASE_URL_PROD not set');
	process.exit(1);
}

const pool = new Pool({ connectionString: NEON_DATABASE_URL_PROD });
const db = drizzle(pool, { schema });

// The Google key is the one the administrator saved under Admin → AI → Models, read
// through the same leaf the app uses so the two can never disagree about whether Google
// is usable. Only the database URL and ENCRYPTION_KEY still come from the environment.
const savedConnections = await listProviderConnections(db).catch((err: unknown) => {
	const reason = err instanceof Error ? err.message : String(err);
	console.error(
		'[%s] Could not read the saved AI provider connections (is the ai schema pushed?): %s',
		SCRIPT_NAME,
		reason,
	);
	process.exit(1);
});
const embeddingConnection = await resolveEmbeddingConnection(savedConnections, process.env.ENCRYPTION_KEY ?? null);
if ('unavailable' in embeddingConnection) {
	console.error(`[%s] ${EMBEDDING_UNAVAILABLE_MESSAGES[embeddingConnection.unavailable]}`, SCRIPT_NAME);
	process.exit(1);
}
const embedModel = createGoogleGenerativeAI({ apiKey: embeddingConnection.apiKey }).embedding(EMBEDDING_MODEL);
const EMBEDDING_OPTS = { google: { outputDimensionality: EMBEDDING_DIMENSIONS } };

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);
const vecLiteral = (v: number[]) => `[${v.join(',')}]`;

const DOC_ID = 'doc_silly_quorblax';
const CHK_IDS = ['chk_silly_constants', 'chk_silly_stewards', 'chk_silly_schedule'];

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

async function resolveUserId(): Promise<string> {
	const cliUser = process.argv[2];
	if (cliUser) return cliUser;
	const row = await db.execute<{ id: string }>(sql`SELECT id FROM auth."user" LIMIT 1`);
	const id = row.rows[0]?.id;
	if (!id) throw new Error('No users in DB; pass a userId as argv[2]');
	return id;
}

async function embedMany_(texts: string[]): Promise<number[][]> {
	const r = await embedMany({ model: embedModel, values: texts, providerOptions: EMBEDDING_OPTS });
	return r.embeddings;
}

async function deleteExisting() {
	console.log('[seed:silly] Removing previous fixture rows...');
	await db.execute(sql`DELETE FROM retrieval.chunk WHERE id LIKE 'chk_silly_%'`);
	await db.execute(sql`DELETE FROM retrieval.document WHERE id = ${DOC_ID}`);
}

async function insertDocumentAndChunks(userId: string) {
	console.log('[seed:silly] Inserting document + chunks...');
	const docHash = hash(CHUNKS.map((c) => c.content).join('\n\n'));
	await db.execute(sql`
		INSERT INTO retrieval.document (id, user_id, title, source, status, total_chunks, total_tokens, content_hash)
		VALUES (${DOC_ID}, ${userId}, 'Quorblaxian Cheese Codex (fictional)', 'text', 'ready', ${CHUNKS.length}, 700, ${docHash})
	`);

	const chunkEmbeddings = await embedMany_(CHUNKS.map((c) => c.content));
	for (let i = 0; i < CHUNKS.length; i++) {
		const c = CHUNKS[i];
		await db.execute(sql`
			INSERT INTO retrieval.chunk (
				id, document_id, user_id, level, position, content, token_count, content_hash,
				embedding_model_id, embedding
			)
			VALUES (
				${c.id}, ${DOC_ID}, ${userId}, 'paragraph', ${i}, ${c.content}, ${Math.ceil(c.content.length / 4)},
				${hash(c.content)}, ${EMBEDDING_MODEL_ID}, ${vecLiteral(chunkEmbeddings[i])}::vector
			)
		`);
	}
}

async function main() {
	const userId = await resolveUserId();
	console.log(`[seed:silly] Seeding for user ${userId}`);
	await deleteExisting();
	await insertDocumentAndChunks(userId);
	console.log(`[seed:silly] Done. 1 doc, ${CHUNKS.length} chunks.`);
	console.log('[seed:silly] Try: "what is the sacred rotation constant of the Quorblaxian cheese ritual?"');
	await pool.end();
}

main().catch((err) => {
	console.error('[seed:silly] Failed:', err);
	process.exit(1);
});
