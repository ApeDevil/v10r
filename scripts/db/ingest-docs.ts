/**
 * ingest-docs — ingest the project documentation (docs/ **\/*.md) into the rag.*
 * corpus so the chatbot can ground "how does X work" answers in the real docs.
 *
 * Runs INSIDE the v10r container (host has no node_modules):
 *
 *   podman exec -it v10r bun run scripts/db/ingest-docs.ts
 *
 * Design (mirrors scripts/db/seed-llmwiki.ts + scripts/db/catalog-sync.ts):
 *   - Hand-rolls its OWN Neon pool + Gemini embedder from process.env — the app's
 *     rawrag `ingest()` / `embed.ts` import `$lib`/`$env` and cannot run under Bun.
 *   - Reuses the Vite-free `planChunks` (the SAME hierarchical section/paragraph
 *     chunker the app `ingest()` uses) + `doc-filter` (relative imports). Replicates
 *     the canonical-path derivation from `src/lib/server/docs/manifest.ts` (Vite-only).
 *   - All rows owned by the reserved SYSTEM_DOCS_USER_ID / PROJECT_DOCS_COLLECTION
 *     (every retrieval query hard-filters user_id). Idempotent: content-hash skip,
 *     soft-delete + re-insert on change, delete-not-seen reconcile for removed files.
 *     Pass --force (or INGEST_FORCE=1) to re-chunk docs after a chunking-LOGIC change (the
 *     per-file content hash only detects content edits). --force is RESUME-SAFE: it skips
 *     docs already in the hierarchical layout, so a conversion interrupted by the free-tier
 *     daily embed cap (1000 embed requests/day) finishes over multiple runs rather than
 *     restarting from the top. To re-chunk an already-hierarchical corpus, clear it first.
 *
 * Produces hierarchical parent(section)+child(paragraph) chunks so retrieval tier-1
 * (hybrid vector+BM25) AND tier-2 (parent-child) both work for the docs corpus, with
 * deterministic heading-breadcrumb context prefixes (per-chunk LLM contextual-prep is
 * deferred — it can't fit the chat-gen quota). The llmwiki page compiler and the
 * tier-3 entity graph are still deferred for docs.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { neonConfig, Pool } from '@neondatabase/serverless';
import { embedMany } from 'ai';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { deriveTitle, isBlocked, parseFrontmatter, slugify } from '../../src/lib/server/docs/doc-filter';
import { buildOverviewBody } from '../../src/lib/server/docs/overview-body';
import {
	CHUNK_OVERLAP,
	EMBEDDING_DIMENSIONS,
	EMBEDDING_MODEL,
	EMBEDDING_MODEL_ID,
	PARAGRAPH_CHUNK_TARGET,
	SECTION_CHUNK_TARGET,
} from '../../src/lib/server/rag-shared/embed-config';
import { planChunks } from '../../src/lib/server/rawrag/plan';

neonConfig.poolQueryViaFetch = true;

// Embedding model + chunk-sizing constants come from the Vite-free embed-config leaf
// (imported above) — the single source of truth shared with the app. Only docs-corpus
// identity + the batch/rate-limit knobs are local to this script.
const SYSTEM_DOCS_USER_ID = 'system-docs';
const PROJECT_DOCS_COLLECTION_ID = 'project-docs';
const EMBED_BATCH = 32;
// Gemini free-tier embeddings cap at 100 requests/minute — pace safely under it.
const MAX_EMBED_PER_MIN = 90;
// Re-chunk + re-embed docs even when their file hash is unchanged. Needed after a
// chunking-LOGIC change (the per-file hash only detects CONTENT edits, not code changes).
// Resume-safe: skips docs already converted to the hierarchical layout (see main()).
const FORCE = process.argv.includes('--force') || process.env.INGEST_FORCE === '1';

const NEON_DATABASE_URL_PROD = process.env.NEON_DATABASE_URL_PROD;
const GEMINI_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!NEON_DATABASE_URL_PROD) {
	console.error('NEON_DATABASE_URL_PROD not set');
	process.exit(1);
}
if (!GEMINI_KEY) {
	console.error('GOOGLE_GENERATIVE_AI_API_KEY not set');
	process.exit(1);
}

const pool = new Pool({ connectionString: NEON_DATABASE_URL_PROD });
const db = drizzle(pool);
const embedModel = createGoogleGenerativeAI({ apiKey: GEMINI_KEY }).embedding(EMBEDDING_MODEL);
const EMBED_OPTS = { google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: 'RETRIEVAL_DOCUMENT' } };

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const shortId = (prefix: string) =>
	`${prefix}_${createHash('sha256').update(`${prefix}${Math.random()}${performance.now()}`).digest('hex').slice(0, 16)}`;
const vecLiteral = (v: number[]) => `[${v.join(',')}]`;

// Canonical filtering + markdown helpers are shared with the /docs manifest via
// src/lib/server/docs/doc-filter.ts (single source of truth — no more hand-sync).
const DOCS_ROOT = fileURLToPath(new URL('../../docs', import.meta.url));

// Docs that render for humans at /docs but must NOT enter the chatbot corpus —
// planned-but-unbuilt designs the assistant would otherwise assert as live code.
const RAG_ONLY_BLOCK = new Set<string>([
	'docs/blueprint/progressive-revelation.md',
	'docs/foundation/progressive-revelation.md',
	// Design record for the persistent/minimizable chatbot. BUILT on dev but uncommitted;
	// the doc also describes deferred pieces (experimental_resume, citation chips on
	// resume). Held from RAG until committed + the corpus is re-ingested, to avoid the
	// assistant asserting the deferred pieces as shipped.
	'docs/blueprint/ai/persistent-chatbot.md',
	// Aspirational format: @toon-format/toon is not a dependency and nothing imports it.
	// The doc's encode()-based examples would be asserted as live code by the assistant.
	'docs/blueprint/ai/toon.md',
	// Planned-not-built fifth-client blueprint: describes an Expo app + requireApiKey
	// guard that do not exist. Held from RAG so the assistant doesn't assert them as shipped.
	'docs/blueprint/architecture/native-client.md',
	// Superseded v4-era design record; the desk+AI feature shipped on AI SDK v6 with a
	// different surface. Kept for /docs rationale, held from RAG to avoid stale-contract answers.
	'docs/blueprint/ai/desk-integration.md',
	// Planning blueprint: documents the RAG/nRAG "showcase-everything" design, most of which is
	// DESIGNED-not-built (llmwiki compile, step-back, reranker, eval, :DEPENDS_ON). If ingested the
	// chatbot would assert these unbuilt features as live. Renders at /docs for humans; held from RAG.
	'docs/blueprint/ai/knowledge-base.md',
	// Companion roadmap to knowledge-base.md: the detailed reranker / step-back / llmwiki-compile
	// specs. Entirely DESIGNED-not-built (no retrieval source code exists for any of it yet). Same
	// hazard as the blueprint — held from RAG so the chatbot can't assert these specs as shipped.
	'docs/blueprint/ai/rag-roadmap.md',
	// Plan record for the chatbot's site-awareness (Vely knows the current public route — the
	// chatbot half of location-awareness). DESIGNED-not-built (4-lens cross-pollination, 2026-06-27).
	// Held from RAG so the chatbot can't assert site-awareness as a live feature. Renders at /docs.
	'docs/blueprint/ai/site-awareness.md',
	// nRAG Observability redesign for the rag-chat showcase (waterfall + unified trace + tier focus
	// filter + Step/Timing views). DESIGNED-not-built (16-agent task force, 2026-06-27); describes a
	// contract rewrite (startOffsetMs, phase axis, registry) and 6 unfixed bugs. Held from RAG so the
	// chatbot can't assert the new observability surface or contract as live. Renders at /docs.
	'docs/blueprint/ai/nrag-observability.md',
]);

interface DocFile {
	sourcePath: string; // docs/…/x.md
	docsPath: string; // /docs/section/slug  (== quick-search doc record path)
	title: string;
	body: string;
	rawHash: string;
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
	if (isBlocked(sourcePath, RAG_ONLY_BLOCK)) return null;

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

	return { sourcePath, docsPath: `/docs/${section}/${slug}`, title, body, rawHash: sha256(raw) };
}

async function ensurePrereqs() {
	await db.execute(sql`
		INSERT INTO auth."user" (id, name, email, email_verified)
		VALUES (${SYSTEM_DOCS_USER_ID}, 'Project Docs', 'system-docs@v10r.local', true)
		ON CONFLICT (id) DO NOTHING
	`);
	await db.execute(sql`
		INSERT INTO rag.collection (id, user_id, name, description)
		VALUES (${PROJECT_DOCS_COLLECTION_ID}, ${SYSTEM_DOCS_USER_ID}, 'Project Docs',
			'Project documentation corpus (docs/**/*.md), tier-1 rawrag.')
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

/** Embed one batch, paced under the quota, with 429 backoff as a safety net. */
async function embedBatch(values: string[], attempt = 0): Promise<number[][]> {
	await awaitEmbedBudget(values.length);
	try {
		const r = await embedMany({ model: embedModel, values, providerOptions: EMBED_OPTS });
		const now = Date.now();
		for (let i = 0; i < values.length; i++) embedTimestamps.push(now);
		return r.embeddings;
	} catch (err) {
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
async function insertDoc(doc: DocFile): Promise<number> {
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
		INSERT INTO rag.document (id, user_id, title, source, source_uri, status, total_chunks, total_tokens, content_hash)
		VALUES (${docId}, ${SYSTEM_DOCS_USER_ID}, ${doc.title}, 'docs', ${doc.docsPath}, 'ready',
			${totalChunks}, ${totalTokens}, ${doc.rawHash})
	`);

	// Parents: section-level context containers — no embedding, no prefix. They surface
	// only via a child's tier-2 parent-fetch, never directly in tier-1.
	for (const p of parents) {
		await db.execute(sql`
			INSERT INTO rag.chunk (
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
			INSERT INTO rag.chunk (
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

const SYSTEM_OVERVIEW_ID = 'lwp_docs_overview';
const OVERVIEW_TITLE = 'Velociraptor (v10r) — Documentation Map';
const OVERVIEW_TLDR =
	'High-level map of v10r, a full-stack reference & test-sandbox. Lists the documentation corpus by section (foundation, blueprint, stack) so broad questions can find the right area, then drill into a specific doc.';
const OVERVIEW_TAGS = ['overview', 'v10r', 'docs'];

/**
 * Write the system-owned overview page — the high-level anchor the chatbot injects for
 * broad questions ("what is v10r", "how do I use it"). Deterministic body (no LLM), one
 * embedding. Idempotent: the partial unique index keys on (collection_id) WHERE
 * kind='overview', so any prior overview for this collection is replaced first.
 */
async function writeSystemOverview(files: DocFile[]): Promise<void> {
	const body = buildOverviewBody(files);
	const [embedding] = await embedAll([`${OVERVIEW_TITLE}\n${OVERVIEW_TLDR}\n${OVERVIEW_TAGS.join(' ')}`]);

	await db.execute(sql`
		DELETE FROM rag.llmwiki_page WHERE kind = 'overview' AND collection_id = ${PROJECT_DOCS_COLLECTION_ID}
	`);
	await db.execute(sql`
		INSERT INTO rag.llmwiki_page (
			id, user_id, collection_id, slug, kind, title, tldr, tldr_hash, body, tags,
			frontmatter, embedding, search_vector, source_hash, source_count,
			compiled_at, compiled_by_model, stale
		)
		VALUES (
			${SYSTEM_OVERVIEW_ID}, ${SYSTEM_DOCS_USER_ID}, ${PROJECT_DOCS_COLLECTION_ID}, 'overview', 'overview',
			${OVERVIEW_TITLE}, ${OVERVIEW_TLDR}, ${sha256(OVERVIEW_TLDR)}, ${body},
			${`{${OVERVIEW_TAGS.join(',')}}`}::text[], '{}'::jsonb,
			${vecLiteral(embedding)}::vector,
			to_tsvector('english',
				${OVERVIEW_TITLE} || ' ' || ${OVERVIEW_TLDR} || ' ' || ${body} || ' ' || ${OVERVIEW_TAGS.join(' ')}
			),
			${sha256(body)}, ${files.length}, now(), 'ingest-docs', false
		)
	`);
	console.log(`[ingest-docs] system overview page written (${files.length} docs mapped).`);
}

async function main() {
	console.log('[ingest-docs] Ensuring system user + collection...');
	await ensurePrereqs();

	const files = listMarkdown(DOCS_ROOT)
		.map(buildDocFile)
		.filter((d): d is DocFile => d !== null);
	console.log(`[ingest-docs] ${files.length} public docs found.`);

	// Current active docs corpus, keyed by canonical path.
	const existing = await db.execute<{ id: string; sourceUri: string; contentHash: string }>(sql`
		SELECT id, source_uri AS "sourceUri", content_hash AS "contentHash"
		FROM rag.document WHERE source = 'docs' AND deleted_at IS NULL
	`);
	const activeByPath = new Map(existing.rows.map((r) => [r.sourceUri, r]));

	// Docs whose ACTIVE version is already in the hierarchical (section + paragraph) layout.
	// In --force mode we skip these, so a re-ingest interrupted by the daily embed cap
	// (1000 embed requests/day on the free tier) RESUMES on the next run instead of redoing
	// converted docs from the top — otherwise a >1000-chunk corpus could never finish.
	const hierarchical = await db.execute<{ sourceUri: string }>(sql`
		SELECT DISTINCT d.source_uri AS "sourceUri"
		FROM rag.document d JOIN rag.chunk c ON c.document_id = d.id
		WHERE d.source = 'docs' AND d.deleted_at IS NULL AND c.level = 'section'
	`);
	const hierarchicalPaths = new Set(hierarchical.rows.map((r) => r.sourceUri));

	let inserted = 0;
	let updated = 0;
	let skipped = 0;
	let chunks = 0;
	const seen: string[] = [];

	for (const doc of files) {
		seen.push(doc.docsPath);
		const prior = activeByPath.get(doc.docsPath);
		if (!FORCE && prior && prior.contentHash === doc.rawHash) {
			skipped++;
			continue;
		}
		// Resume-safe force: don't redo docs already converted to the hierarchical layout,
		// so a conversion interrupted by the daily embed cap finishes across multiple runs.
		if (FORCE && prior && hierarchicalPaths.has(doc.docsPath)) {
			skipped++;
			continue;
		}
		if (prior) {
			// Changed — soft-delete the prior version (forward-safe vs page_source restrict).
			await db.execute(sql`UPDATE rag.document SET deleted_at = now() WHERE id = ${prior.id}`);
			updated++;
		} else {
			inserted++;
		}
		const n = await insertDoc(doc);
		chunks += n;
		console.log(`[ingest-docs] ${prior ? 'upd' : 'new'} ${doc.docsPath} (+${n} chunks)`);
	}

	// Delete-not-seen reconcile: soft-delete active docs whose file is gone.
	// Diffed in JS against the already-loaded active set, then soft-deleted by id
	// (single-value params — a JS array interpolated into a `sql` template spreads
	// into `($1,…,$n)`, a row expr that breaks `<> ALL(...)`, which needs a real array).
	const seenSet = new Set(seen);
	const stale = existing.rows.filter((r) => !seenSet.has(r.sourceUri));
	for (const r of stale) {
		await db.execute(sql`UPDATE rag.document SET deleted_at = now() WHERE id = ${r.id}`);
	}

	await writeSystemOverview(files);

	console.log(
		`[ingest-docs] Done. ${inserted} new, ${updated} updated, ${skipped} unchanged, ` +
			`${stale.length} removed; ${chunks} chunks embedded.`,
	);
	await pool.end();
}

main().catch((err) => {
	console.error('[ingest-docs] Failed:', err);
	process.exit(1);
});
