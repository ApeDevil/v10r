/**
 * ingest-docs — ingest the project documentation (docs/ **\/*.md) into the retrieval.*
 * corpus so the chatbot can ground "how does X work" answers in the real docs.
 *
 * Runs INSIDE the v10r container (host has no node_modules):
 *
 *   podman exec -it v10r bun run scripts/db/ingest-docs.ts
 *
 * Design (mirrors scripts/db/catalog-sync.ts):
 *   - Hand-rolls its OWN Neon pool + Gemini embedder from process.env — the app's
 *     retrieval `ingest()` / `embed.ts` reach `$app/env`, which exists only inside Vite.
 *   - Reuses the Vite-free `planChunks` (the SAME hierarchical section/paragraph
 *     chunker the app `ingest()` uses) + `doc-filter` (relative imports). Replicates
 *     the canonical-path derivation from `src/lib/server/docs/manifest.ts` (Vite-only).
 *   - All rows owned by the reserved SYSTEM_DOCS_USER_ID / PROJECT_DOCS_COLLECTION
 *     (every retrieval query hard-filters user_id). Idempotent by derivation key: a doc is
 *     re-derived only when `derivationKey(docs-ingest@N, [file hash, chunker@version + sizing,
 *     embedding model])` differs from the stored one, so a chunker, sizing or model change
 *     re-derives the corpus without a flag, and an unchanged corpus costs zero embeds.
 *     Soft-delete + re-insert on change, delete-not-seen reconcile for removed files. A full
 *     re-derive burns embed quota for the whole corpus (free tier: 1000 embed requests/day);
 *     a run cut short by the quota leaves the rest keyed as stale, so the next run resumes.
 *
 * Produces hierarchical parent(section)+child(paragraph) chunks so retrieval tier-1
 * (hybrid vector+BM25) AND tier-2 (parent-child) both work for the docs corpus, with
 * deterministic heading-breadcrumb context prefixes (per-chunk LLM contextual-prep is
 * deferred — it can't fit the chat-gen quota). The tier-3 entity graph is still deferred
 * for docs. The corpus map (`retrieval.corpus_map`) is rebuilt on every run.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { neonConfig, Pool } from '@neondatabase/serverless';
import { APICallError, embedMany, RetryError } from 'ai';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { EMBEDDING_UNAVAILABLE_MESSAGES, resolveEmbeddingConnection } from '../../src/lib/server/ai/connections';
import { listProviderConnections } from '../../src/lib/server/db/ai/provider-connections';
import { contentHash, derivationKey } from '../../src/lib/server/db/content-hash';
import * as schema from '../../src/lib/server/db/schema';
import { deriveTitle, isBlocked, parseFrontmatter, slugify } from '../../src/lib/server/docs/doc-filter';
import { buildOverviewBody } from '../../src/lib/server/docs/overview-body';
import { chunkingInput, planChunks } from '../../src/lib/server/retrieval/plan';
import {
	CHUNK_OVERLAP,
	EMBEDDING_DIMENSIONS,
	EMBEDDING_INPUT,
	EMBEDDING_MODEL,
	EMBEDDING_MODEL_ID,
	PARAGRAPH_CHUNK_TARGET,
	SECTION_CHUNK_TARGET,
} from '../../src/lib/server/retrieval-shared/embed-config';
import { tryParseKeyRing } from '../../src/lib/server/security/aes-gcm';

neonConfig.poolQueryViaFetch = true;

// Embedding model + chunk-sizing constants come from the Vite-free embed-config leaf
// (imported above) — the single source of truth shared with the app. Only docs-corpus
// identity + the batch/rate-limit knobs are local to this script.
const SYSTEM_DOCS_USER_ID = 'system-docs';
const PROJECT_DOCS_COLLECTION_ID = 'project-docs';
const EMBED_BATCH = 32;
// Gemini free-tier embeddings cap at 100 requests/minute — pace safely under it.
const MAX_EMBED_PER_MIN = 90;
/**
 * Version of THIS script's transform: the title rule, the deterministic "<title> › <heading>"
 * context prefix and the parent/child storage shape below. Bump it when one of those changes
 * what gets embedded; the chunker, sizing and embedding model are keyed separately.
 */
const DOCS_INGEST_TRANSFORM = 'docs-ingest@1';

const SCRIPT_NAME = 'ingest-docs';
const NEON_DATABASE_URL_PROD = process.env.NEON_DATABASE_URL_PROD;
if (!NEON_DATABASE_URL_PROD) {
	console.error('NEON_DATABASE_URL_PROD not set');
	process.exit(1);
}

const pool = new Pool({ connectionString: NEON_DATABASE_URL_PROD });
const db = drizzle(pool, { schema });

// The Google key is the one the administrator saved under Admin → AI → Models, read
// through the same leaf the app uses so the two can never disagree about whether Google
// is usable. Only the database URL and the ENCRYPTION_KEY ring still come from the environment.
const savedConnections = await listProviderConnections(db).catch((err: unknown) => {
	const reason = err instanceof Error ? err.message : String(err);
	console.error(
		'[%s] Could not read the saved AI provider connections (is the ai schema pushed?): %s',
		SCRIPT_NAME,
		reason,
	);
	process.exit(1);
});
const embeddingConnection = await resolveEmbeddingConnection(
	savedConnections,
	tryParseKeyRing(process.env.ENCRYPTION_KEY, process.env.ENCRYPTION_KEY_PREVIOUS),
);
if ('unavailable' in embeddingConnection) {
	console.error(`[%s] ${EMBEDDING_UNAVAILABLE_MESSAGES[embeddingConnection.unavailable]}`, SCRIPT_NAME);
	process.exit(1);
}
const embedModel = createGoogleGenerativeAI({ apiKey: embeddingConnection.apiKey }).embedding(EMBEDDING_MODEL);
const EMBED_OPTS = { google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: 'RETRIEVAL_DOCUMENT' } };

const shortId = (prefix: string) =>
	`${prefix}_${createHash('sha256').update(`${prefix}${Math.random()}${performance.now()}`).digest('hex').slice(0, 16)}`;
const vecLiteral = (v: number[]) => `[${v.join(',')}]`;

// Canonical filtering + markdown helpers are shared with the /docs manifest via
// src/lib/server/docs/doc-filter.ts (single source of truth — no more hand-sync).
const DOCS_ROOT = fileURLToPath(new URL('../../docs', import.meta.url));

// Docs that render for humans at /docs but must NOT enter the chatbot corpus —
// planned-but-unbuilt designs the assistant would otherwise assert as live code.
const RETRIEVAL_ONLY_BLOCK = new Set<string>([
	// Design record for the persistent/minimizable chatbot. BUILT on dev but uncommitted;
	// the doc also describes deferred pieces (experimental_resume, citation chips on
	// resume). Held from the retrieval corpus until committed + the corpus is re-ingested, to avoid the
	// assistant asserting the deferred pieces as shipped.
	'docs/blueprint/ai/persistent-chatbot.md',
	// Aspirational format: @toon-format/toon is not a dependency and nothing imports it.
	// The doc's encode()-based examples would be asserted as live code by the assistant.
	'docs/blueprint/ai/toon.md',
	// Planned-not-built fifth-client blueprint: describes an Expo app + requireApiKey
	// guard that do not exist. Held from the retrieval corpus so the assistant doesn't assert them as shipped.
	'docs/blueprint/architecture/native-client.md',
	// Superseded v4-era design record; the desk+AI feature shipped on AI SDK v6 with a
	// different surface. Kept for /docs rationale, held from the retrieval corpus to avoid stale-contract answers.
	'docs/blueprint/ai/desk-integration.md',
	// Planning blueprint: documents the retrieval "showcase-everything" design, most of which is
	// DESIGNED-not-built (step-back, reranker, eval, :DEPENDS_ON). If ingested the
	// chatbot would assert these unbuilt features as live. Renders at /docs for humans; held from the retrieval corpus.
	'docs/blueprint/ai/knowledge-base.md',
	// Companion roadmap to knowledge-base.md: the detailed reranker / step-back
	// specs. Entirely DESIGNED-not-built (no retrieval source code exists for any of it yet). Same
	// hazard as the blueprint — held from the retrieval corpus so the chatbot can't assert these specs as shipped.
	'docs/blueprint/ai/rag-roadmap.md',
	// Plan record for the chatbot's site-awareness (Vely knows the current public route — the
	// chatbot half of location-awareness). DESIGNED-not-built (4-lens cross-pollination, 2026-06-27).
	// Held from the retrieval corpus so the chatbot can't assert site-awareness as a live feature. Renders at /docs.
	'docs/blueprint/ai/site-awareness.md',
]);

interface DocFile {
	sourcePath: string; // docs/…/x.md
	docsPath: string; // /docs/section/slug  (== quick-search doc record path)
	title: string;
	body: string;
	raw: string;
}

/** A doc plus the key of the chunks and embeddings it should currently have. */
interface KeyedDoc extends DocFile {
	rawHash: string;
	derivationKey: string;
}

/** Sizing and model are inputs of every docs derivation, independent of the file. */
const CHUNKING_INPUT = chunkingInput({
	sectionTarget: SECTION_CHUNK_TARGET,
	paragraphTarget: PARAGRAPH_CHUNK_TARGET,
	overlap: CHUNK_OVERLAP,
});

async function keyDoc(doc: DocFile): Promise<KeyedDoc> {
	const rawHash = await contentHash(doc.raw);
	const key = await derivationKey(DOCS_INGEST_TRANSFORM, [rawHash, CHUNKING_INPUT, EMBEDDING_INPUT]);
	return { ...doc, rawHash, derivationKey: key };
}

/** Recursively list every *.md under docs/, returning repo-relative paths. */
function listMarkdown(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const abs = join(dir, name);
		if (statSync(abs).isDirectory()) {
			out.push(...listMarkdown(abs));
		} else if (name.endsWith('.md')) {
			out.push(abs);
		}
	}
	return out;
}

function buildDocFile(absPath: string): DocFile | null {
	const sourcePath = `docs/${relative(DOCS_ROOT, absPath).split('\\').join('/')}`;
	if (isBlocked(sourcePath, RETRIEVAL_ONLY_BLOCK)) return null;

	const parts = sourcePath.split('/');
	const sectionDir = parts[1];
	const section =
		sectionDir === 'foundation' ||
		sectionDir === 'blueprint' ||
		sectionDir === 'stack' ||
		sectionDir === 'pattern-library'
			? sectionDir
			: null;
	if (!section) return null;

	const raw = readFileSync(absPath, 'utf8');
	const { frontmatter, body } = parseFrontmatter(raw);
	if (frontmatter.published === false || frontmatter.draft === true) return null;

	const title = (typeof frontmatter.title === 'string' ? frontmatter.title : null) ?? deriveTitle(body);
	if (!title) {
		console.warn(`[ingest-docs] skip ${sourcePath}: no title (frontmatter.title or # H1)`);
		return null;
	}

	const fileBase = parts[parts.length - 1].replace(/\.md$/, '');
	const slug = section === 'blueprint' ? parts.slice(2).join('/').replace(/\.md$/, '') : slugify(fileBase);

	return { sourcePath, docsPath: `/docs/${section}/${slug}`, title, body, raw };
}

async function ensurePrereqs() {
	await db.execute(sql`
		INSERT INTO auth."user" (id, name, email, email_verified)
		VALUES (${SYSTEM_DOCS_USER_ID}, 'Project Docs', 'system-docs@v10r.local', true)
		ON CONFLICT (id) DO NOTHING
	`);
	await db.execute(sql`
		INSERT INTO retrieval.collection (id, user_id, name, description)
		VALUES (${PROJECT_DOCS_COLLECTION_ID}, ${SYSTEM_DOCS_USER_ID}, 'Project Docs',
			'Project documentation corpus (docs/**/*.md), tier-1 retrieval.')
		ON CONFLICT (id) DO NOTHING
	`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const embedTimestamps: number[] = []; // rolling 60s window of embedding requests

/** Block until `count` more embeddings fit under the rolling per-minute budget. */
async function awaitEmbedBudget(count: number): Promise<void> {
	for (;;) {
		const now = Date.now();
		while (embedTimestamps.length > 0 && now - embedTimestamps[0] > 60_000) embedTimestamps.shift();
		if (embedTimestamps.length + count <= MAX_EMBED_PER_MIN) return;
		await sleep(60_000 - (now - embedTimestamps[0]) + 250);
	}
}

/** The longest wait a quota error may ask for before the run stops instead of backing off. */
const MAX_QUOTA_WAIT_S = 300;

/** A quota that will not reset within this run (the free tier's daily embed cap). */
class EmbedQuotaExhausted extends Error {
	constructor(waitSeconds: number) {
		const hours = Math.floor(waitSeconds / 3600);
		const minutes = Math.ceil((waitSeconds % 3600) / 60);
		super(
			`embed quota exhausted until it resets (the provider asks to retry in ~${hours}h${minutes}m). ` +
				'Re-run then; docs already keyed are skipped.',
		);
	}
}

/**
 * The wait a quota error asks for, in seconds, from the body's `RetryInfo`
 * (`"retryDelay": "51310s"`). A per-minute limit asks for seconds, a daily one for hours.
 * The AI SDK wraps its own retries in a `RetryError`, so every attempt is read.
 */
function quotaRetryDelaySeconds(err: unknown): number | null {
	let longest: number | null = null;
	for (const cause of RetryError.isInstance(err) ? err.errors : [err]) {
		if (!APICallError.isInstance(cause)) continue;
		const match = cause.responseBody?.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/);
		if (match) longest = Math.max(longest ?? 0, Number(match[1]));
	}
	return longest;
}

/**
 * Embed one batch, paced under the quota, with 429 backoff as a safety net. Backoff only
 * helps a per-minute limit; a quota that asks for a longer wait stops the run at once.
 */
async function embedBatch(values: string[], attempt = 0): Promise<number[][]> {
	await awaitEmbedBudget(values.length);
	try {
		const r = await embedMany({ model: embedModel, values, providerOptions: EMBED_OPTS });
		const now = Date.now();
		for (let i = 0; i < values.length; i++) embedTimestamps.push(now);
		return r.embeddings;
	} catch (err) {
		const wait = quotaRetryDelaySeconds(err);
		if (wait !== null && wait > MAX_QUOTA_WAIT_S) throw new EmbedQuotaExhausted(wait);
		if (attempt < 6 && /quota|rate|429|RESOURCE_EXHAUSTED/i.test(String(err))) {
			console.warn(`[ingest-docs] embed quota hit — backing off 35s (retry ${attempt + 1})`);
			await sleep(35_000);
			return embedBatch(values, attempt + 1);
		}
		throw err;
	}
}

async function embedAll(texts: string[]): Promise<number[][]> {
	const out: number[][] = [];
	for (let i = 0; i < texts.length; i += EMBED_BATCH) {
		out.push(...(await embedBatch(texts.slice(i, i + EMBED_BATCH))));
	}
	return out;
}

/** Deepest ATX heading text in a chunk, or '' if it contains none. */
function deepestHeading(text: string): string {
	let last = '';
	for (const m of text.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) last = m[1].trim();
	return last;
}

/** Insert one document as hierarchical parent(section)+child(paragraph) chunks. Returns total count. */
async function insertDoc(doc: KeyedDoc): Promise<number> {
	const { parents, children } = await planChunks(doc.body, {
		sectionTarget: SECTION_CHUNK_TARGET,
		paragraphTarget: PARAGRAPH_CHUNK_TARGET,
		overlap: CHUNK_OVERLAP,
	});

	// Deterministic context prefix = "<title> › <nearest heading>" — no LLM (per-chunk
	// contextual-prep can't fit the chat-gen quota). Carry the last seen heading forward
	// so continuation paragraphs inherit their section's heading.
	let currentHeading = '';
	const childPrefix = children.map((c) => {
		const h = deepestHeading(c.content);
		if (h) currentHeading = h;
		return currentHeading ? `${doc.title} › ${currentHeading}` : doc.title;
	});

	// Embed CHILDREN only — parents are context containers, left unembedded so tier-1
	// never surfaces a whole section (mirrors the app ingest()).
	const embeddings = await embedAll(children.map((c, i) => `${childPrefix[i]}\n${c.content}`));

	const docId = shortId('doc_docs');
	const totalChunks = parents.length + children.length;
	const totalTokens = parents.reduce((s, p) => s + p.tokenCount, 0) + children.reduce((s, c) => s + c.tokenCount, 0);
	await db.execute(sql`
		INSERT INTO retrieval.document (
			id, user_id, title, source, source_uri, status, total_chunks, total_tokens, content_hash, derivation_key
		)
		VALUES (${docId}, ${SYSTEM_DOCS_USER_ID}, ${doc.title}, 'docs', ${doc.docsPath}, 'ready',
			${totalChunks}, ${totalTokens}, ${doc.rawHash}, ${doc.derivationKey})
	`);

	// Parents: section-level context containers — no embedding, no prefix. They surface
	// only via a child's tier-2 parent-fetch, never directly in tier-1.
	for (const p of parents) {
		await db.execute(sql`
			INSERT INTO retrieval.chunk (
				id, document_id, user_id, parent_id, level, position, content, context_prefix, token_count, content_hash,
				embedding_model_id, embedding
			)
			VALUES (
				${p.id}, ${docId}, ${SYSTEM_DOCS_USER_ID}, NULL, 'section', ${p.position}, ${p.content}, NULL,
				${p.tokenCount}, ${p.contentHash}, NULL, NULL
			)
			ON CONFLICT DO NOTHING
		`);
	}

	// Children: paragraph-level, embedded, linked to their section parent.
	for (let i = 0; i < children.length; i++) {
		const c = children[i];
		await db.execute(sql`
			INSERT INTO retrieval.chunk (
				id, document_id, user_id, parent_id, level, position, content, context_prefix, token_count, content_hash,
				embedding_model_id, embedding
			)
			VALUES (
				${c.id}, ${docId}, ${SYSTEM_DOCS_USER_ID}, ${c.parentId ?? null}, 'paragraph', ${c.position}, ${c.content}, ${childPrefix[i]},
				${c.tokenCount}, ${c.contentHash}, ${EMBEDDING_MODEL_ID}, ${vecLiteral(embeddings[i])}::vector
			)
			ON CONFLICT DO NOTHING
		`);
	}

	return totalChunks;
}

const PROJECT_MAP_ID = 'map_project_docs';
const PROJECT_MAP_TITLE = 'Velociraptor (v10r) — Documentation Map';

/**
 * Write the project docs corpus map — the high-level anchor the chatbot injects as
 * `<project-overview>` for broad questions ("what is v10r", "how do I use it"). A
 * deterministic body (no LLM, no embedding): one row per collection, replaced in place.
 */
async function writeProjectMap(files: DocFile[]): Promise<void> {
	const body = buildOverviewBody(files);
	await db.execute(sql`
		INSERT INTO retrieval.corpus_map (id, user_id, collection_id, title, body, built_at)
		VALUES (${PROJECT_MAP_ID}, ${SYSTEM_DOCS_USER_ID}, ${PROJECT_DOCS_COLLECTION_ID}, ${PROJECT_MAP_TITLE}, ${body}, now())
		ON CONFLICT (collection_id) DO UPDATE
			SET id = EXCLUDED.id, user_id = EXCLUDED.user_id, title = EXCLUDED.title, body = EXCLUDED.body, built_at = now()
	`);
	console.log(`[ingest-docs] project docs corpus map written (${files.length} docs mapped).`);
}

async function main() {
	console.log('[ingest-docs] Ensuring system user + collection...');
	await ensurePrereqs();

	const files = await Promise.all(
		listMarkdown(DOCS_ROOT)
			.map(buildDocFile)
			.filter((d): d is DocFile => d !== null)
			.map(keyDoc),
	);
	console.log(`[ingest-docs] ${files.length} public docs found.`);

	// Current active docs corpus, keyed by canonical path.
	const existing = await db.execute<{ id: string; sourceUri: string; derivationKey: string | null }>(sql`
		SELECT id, source_uri AS "sourceUri", derivation_key AS "derivationKey"
		FROM retrieval.document WHERE source = 'docs' AND deleted_at IS NULL
	`);
	const activeByPath = new Map(existing.rows.map((r) => [r.sourceUri, r]));

	let inserted = 0;
	let updated = 0;
	let skipped = 0;
	let chunks = 0;
	const seen: string[] = [];

	for (const doc of files) {
		seen.push(doc.docsPath);
		const prior = activeByPath.get(doc.docsPath);
		// Null (derived before keys existed) never matches, so such a doc is re-derived once.
		if (prior && prior.derivationKey === doc.derivationKey) {
			skipped++;
			continue;
		}
		// The fresh copy first, the prior one retired only once it landed: a run cut short by
		// the embed quota (insertDoc embeds before it writes) then leaves the old copy
		// searchable instead of a hole — the same order `syncDeskFileToRetrieval` keeps.
		let n: number;
		try {
			n = await insertDoc(doc);
		} catch (err) {
			// The reconcile below must not run on a partial `seen`; report how far this run got.
			if (err instanceof EmbedQuotaExhausted) {
				const left = files.length - skipped - inserted - updated;
				console.log(
					`[ingest-docs] ${inserted} new, ${updated} updated, ${skipped} unchanged; ${left} not reached (keyed ones skip next run).`,
				);
			}
			throw err;
		}
		chunks += n;
		if (prior) {
			// Soft-delete, not delete: forward-safe vs the page_source restrict.
			await db.execute(sql`UPDATE retrieval.document SET deleted_at = now() WHERE id = ${prior.id}`);
			updated++;
		} else {
			inserted++;
		}
		console.log(`[ingest-docs] ${prior ? 'upd' : 'new'} ${doc.docsPath} (+${n} chunks)`);
	}

	// Delete-not-seen reconcile: soft-delete active docs whose file is gone.
	// Diffed in JS against the already-loaded active set, then soft-deleted by id
	// (single-value params — a JS array interpolated into a `sql` template spreads
	// into `($1,…,$n)`, a row expr that breaks `<> ALL(...)`, which needs a real array).
	const seenSet = new Set(seen);
	const stale = existing.rows.filter((r) => !seenSet.has(r.sourceUri));
	for (const r of stale) {
		await db.execute(sql`UPDATE retrieval.document SET deleted_at = now() WHERE id = ${r.id}`);
	}

	await writeProjectMap(files);

	console.log(
		`[ingest-docs] Done. ${inserted} new, ${updated} updated, ${skipped} unchanged, ` +
			`${stale.length} removed; ${chunks} chunks embedded.`,
	);
	await pool.end();
}

main().catch((err) => {
	if (err instanceof EmbedQuotaExhausted) console.error(`[ingest-docs] Stopped: ${err.message}`);
	else console.error('[ingest-docs] Failed:', err);
	process.exit(1);
});
