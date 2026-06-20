/**
 * ingest-docs — ingest the project documentation (docs/ **\/*.md) into the rag.*
 * corpus so the chatbot can ground "how does X work" answers in the real docs.
 *
 * Runs INSIDE the v10r container (host has no node_modules):
 *
 *   podman exec -it v10r bun run scripts/db/ingest-docs.ts
 *
 * Design (mirrors scripts/seed-llmwiki.ts + scripts/db/catalog-sync.ts):
 *   - Hand-rolls its OWN Neon pool + Gemini embedder from process.env — the app's
 *     rawrag `ingest()` / `embed.ts` import `$lib`/`$env` and cannot run under Bun.
 *   - Reuses ONLY the Vite-free `splitMarkdown` (relative import) for heading-aware
 *     chunking. Replicates the docs blocklist + canonical-path derivation from
 *     `src/lib/server/docs/manifest.ts` (which is Vite-only via import.meta.glob).
 *   - All rows owned by the reserved SYSTEM_DOCS_USER_ID / PROJECT_DOCS_COLLECTION
 *     (every retrieval query hard-filters user_id). Idempotent: content-hash skip,
 *     soft-delete + re-insert on change, delete-not-seen reconcile for removed files.
 *
 * Tier-1 (rawrag chunks) only — the llmwiki tier-2 compiler is deferred.
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
import { parse as parseYaml } from 'yaml';
import { splitMarkdown } from '../../src/lib/server/rawrag/markdown-split';

neonConfig.poolQueryViaFetch = true;

// Keep in sync with src/lib/server/config.ts (constants can't be imported here —
// config.ts sits behind the $lib alias the Bun runtime doesn't resolve).
const SYSTEM_DOCS_USER_ID = 'system-docs';
const PROJECT_DOCS_COLLECTION_ID = 'project-docs';
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_MODEL_ID = 'google-gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 1536;
const PARAGRAPH_CHUNK_TARGET = 300;
const CHUNK_OVERLAP = 50;
const EMBED_BATCH = 32;
// Gemini free-tier embeddings cap at 100 requests/minute — pace safely under it.
const MAX_EMBED_PER_MIN = 90;

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
const estimateTokens = (t: string) => Math.ceil(t.length / 4);

// ── Blocklist + path derivation — replicated from src/lib/server/docs/manifest.ts ──
// (Drift risk: keep aligned, or factor into a shared Vite-free module — see plan.)
const DOCS_ROOT = fileURLToPath(new URL('../../docs', import.meta.url));
const BLOCKLIST = new Set([
	'docs/blueprint/blog.md',
	'docs/blueprint/style-randomizer.md',
	'docs/blueprint/style-randomizer-v2.md',
	'docs/blueprint/style-randomizer-implementation-plan.md',
	'docs/blueprint/color-differentiation-plan.md',
	'docs/blueprint/visual-identity-architecture.md',
	'docs/blueprint/admin-expansion.md',
	'docs/stack/vendors.md',
]);
const BLOCKED_PREFIXES = ['docs/guides/', 'docs/blueprint/desk/', 'docs/blueprint/design/'];

function isBlocked(sourcePath: string): boolean {
	if (BLOCKLIST.has(sourcePath)) return true;
	if (sourcePath.endsWith('/README.md')) return true;
	return BLOCKED_PREFIXES.some((p) => sourcePath.startsWith(p));
}

function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

function parseFrontmatter(raw: string): { frontmatter: Record<string, unknown>; body: string } {
	if (!raw.startsWith('---\n')) return { frontmatter: {}, body: raw };
	const end = raw.indexOf('\n---', 4);
	if (end === -1) return { frontmatter: {}, body: raw };
	try {
		const fm = (parseYaml(raw.slice(4, end)) as Record<string, unknown> | null) ?? {};
		return { frontmatter: fm, body: raw.slice(end + 4).replace(/^\n/, '') };
	} catch {
		return { frontmatter: {}, body: raw };
	}
}

function deriveTitle(body: string): string | null {
	for (const line of body.split('\n')) {
		const m = /^#\s+(.+)$/.exec(line.trim());
		if (m) return m[1].trim();
	}
	return null;
}

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
	if (isBlocked(sourcePath)) return null;

	const parts = sourcePath.split('/');
	const sectionDir = parts[1];
	const section =
		sectionDir === 'foundation' || sectionDir === 'blueprint' || sectionDir === 'stack' ? sectionDir : null;
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

/** Insert one document + its embedded chunks. Returns chunk count. */
async function insertDoc(doc: DocFile): Promise<number> {
	const chunkTexts = splitMarkdown(doc.body, { targetTokens: PARAGRAPH_CHUNK_TARGET, overlapTokens: CHUNK_OVERLAP });
	const embeddings = await embedAll(chunkTexts.map((t) => `${doc.title}\n\n${t}`));

	const docId = shortId('doc_docs');
	const totalTokens = chunkTexts.reduce((s, t) => s + estimateTokens(t), 0);
	await db.execute(sql`
		INSERT INTO rag.document (id, user_id, title, source, source_uri, status, total_chunks, total_tokens, content_hash)
		VALUES (${docId}, ${SYSTEM_DOCS_USER_ID}, ${doc.title}, 'docs', ${doc.docsPath}, 'ready',
			${chunkTexts.length}, ${totalTokens}, ${doc.rawHash})
	`);

	for (let i = 0; i < chunkTexts.length; i++) {
		await db.execute(sql`
			INSERT INTO rag.chunk (
				id, document_id, level, position, content, context_prefix, token_count, content_hash,
				embedding_model_id, embedding
			)
			VALUES (
				${shortId('chk_docs')}, ${docId}, 'paragraph', ${i}, ${chunkTexts[i]}, ${doc.title},
				${estimateTokens(chunkTexts[i])}, ${sha256(chunkTexts[i])}, ${EMBEDDING_MODEL_ID},
				${vecLiteral(embeddings[i])}::vector
			)
			ON CONFLICT DO NOTHING
		`);
	}
	return chunkTexts.length;
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

	let inserted = 0;
	let updated = 0;
	let skipped = 0;
	let chunks = 0;
	const seen: string[] = [];

	for (const doc of files) {
		seen.push(doc.docsPath);
		const prior = activeByPath.get(doc.docsPath);
		if (prior && prior.contentHash === doc.rawHash) {
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
	const removed = seen.length
		? await db.execute(sql`
			UPDATE rag.document SET deleted_at = now()
			WHERE source = 'docs' AND deleted_at IS NULL AND source_uri <> ALL(${seen})
		`)
		: { rowCount: 0 };

	console.log(
		`[ingest-docs] Done. ${inserted} new, ${updated} updated, ${skipped} unchanged, ` +
			`${removed.rowCount ?? 0} removed; ${chunks} chunks embedded.`,
	);
	await pool.end();
}

main().catch((err) => {
	console.error('[ingest-docs] Failed:', err);
	process.exit(1);
});
