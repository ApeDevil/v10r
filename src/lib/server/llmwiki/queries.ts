/**
 * Read-side queries for the llmwiki layer.
 *
 * All queries are user-scoped via `user_id` on llmwiki_page and/or the joined
 * document. Nothing here should mutate.
 */

import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { llmwikiPage, llmwikiPageRedirect } from '$lib/server/db/schema/rag';
import { POINTER_CAP } from './config';
import type { LlmwikiPage, LlmwikiPointer } from './types';

/**
 * Hydrate top-K rawrag pointers for each given llmwiki page.
 * Single JOIN using ROW_NUMBER() window — no N+1. User-scoped via document.
 */
export async function hydratePointers(
	pageIds: string[],
	userId: string,
	cap = POINTER_CAP,
): Promise<Map<string, LlmwikiPointer[]>> {
	const result = new Map<string, LlmwikiPointer[]>();
	if (pageIds.length === 0) return result;

	const rows = await db.execute<{
		llmwikiPageId: string;
		chunkId: string;
		documentId: string;
		documentTitle: string;
		weight: number;
	}>(sql`
		SELECT s.llmwiki_page_id AS "llmwikiPageId",
		       s.chunk_id AS "chunkId",
		       s.document_id AS "documentId",
		       d.title AS "documentTitle",
		       s.weight AS weight
		FROM (
			SELECT llmwiki_page_id, chunk_id, document_id, weight,
			       ROW_NUMBER() OVER (
			         PARTITION BY llmwiki_page_id
			         ORDER BY weight DESC, chunk_id ASC
			       ) AS rn
			FROM rag.llmwiki_page_source
			WHERE llmwiki_page_id IN (${sql.join(
				pageIds.map((id) => sql`${id}`),
				sql`, `,
			)})
		) s
		JOIN rag.document d ON d.id = s.document_id
		WHERE s.rn <= ${cap}
		  AND d.user_id = ${userId}
		  AND d.deleted_at IS NULL
		ORDER BY s.llmwiki_page_id, s.weight DESC
	`);

	for (const row of rows.rows) {
		const list = result.get(row.llmwikiPageId) ?? [];
		list.push({
			chunkId: row.chunkId,
			documentId: row.documentId,
			documentTitle: row.documentTitle,
			weight: Number(row.weight),
		});
		result.set(row.llmwikiPageId, list);
	}
	return result;
}

/**
 * Compute coverage flags per page:
 *   sourceCount = total source chunks cited
 *   stale = staleness threshold crossed (any cited chunk hash changed)
 *
 * Staleness is a query-time signal — the nightly lint writes to
 * llmwiki_page.stale too, but this catches drift between lint runs.
 */
export async function computeCoverage(
	pageIds: string[],
	userId: string,
): Promise<Map<string, { sourceCount: number; stale: boolean }>> {
	const result = new Map<string, { sourceCount: number; stale: boolean }>();
	if (pageIds.length === 0) return result;

	const rows = await db.execute<{ pageId: string; total: number; drifted: number }>(sql`
		SELECT s.llmwiki_page_id AS "pageId",
		       COUNT(*)::int AS total,
		       COUNT(*) FILTER (WHERE s.source_hash_at_compile <> c.content_hash)::int AS drifted
		FROM rag.llmwiki_page_source s
		JOIN rag.chunk c ON c.id = s.chunk_id
		JOIN rag.document d ON d.id = s.document_id
		WHERE s.llmwiki_page_id IN (${sql.join(
			pageIds.map((id) => sql`${id}`),
			sql`, `,
		)})
		  AND d.user_id = ${userId}
		  AND d.deleted_at IS NULL
		GROUP BY s.llmwiki_page_id
	`);

	for (const row of rows.rows) {
		const total = Number(row.total);
		const drifted = Number(row.drifted);
		result.set(row.pageId, {
			sourceCount: total,
			stale: total > 0 && drifted / total >= 0.2,
		});
	}
	return result;
}

/**
 * Fetch full pages by ID *or* slug.
 * The `get_llmwiki_pages` tool advertises "slug or id", so we match both.
 * Result map is keyed by whatever the caller passed in (id OR slug), so
 * `missing = keys - Object.keys(result)` works symmetrically.
 */
export async function fetchPagesByIds(
	keys: string[],
	userId: string,
	options: { includeBody?: boolean } = {},
): Promise<Map<string, LlmwikiPage>> {
	const result = new Map<string, LlmwikiPage>();
	if (keys.length === 0) return result;

	const rows = await db
		.select({
			id: llmwikiPage.id,
			slug: llmwikiPage.slug,
			title: llmwikiPage.title,
			tldr: llmwikiPage.tldr,
			body: llmwikiPage.body,
			tags: llmwikiPage.tags,
			stale: llmwikiPage.stale,
			compiledAt: llmwikiPage.compiledAt,
			compiledByModel: llmwikiPage.compiledByModel,
		})
		.from(llmwikiPage)
		.where(
			and(
				or(inArray(llmwikiPage.id, keys), inArray(llmwikiPage.slug, keys)),
				eq(llmwikiPage.userId, userId),
				isNull(llmwikiPage.deletedAt),
			),
		);

	const pointers = await hydratePointers(
		rows.map((r) => r.id),
		userId,
	);
	const coverage = await computeCoverage(
		rows.map((r) => r.id),
		userId,
	);

	// Build lookup by BOTH id and slug, so either key format resolves.
	const byId = new Map<string, (typeof rows)[number]>();
	const bySlug = new Map<string, (typeof rows)[number]>();
	for (const r of rows) {
		byId.set(r.id, r);
		bySlug.set(r.slug, r);
	}

	for (const key of keys) {
		const r = byId.get(key) ?? bySlug.get(key);
		if (!r) continue;
		if (result.has(key)) continue;
		result.set(key, {
			slug: r.slug,
			title: r.title,
			tldr: r.tldr,
			body: options.includeBody ? r.body : '',
			tags: r.tags,
			coverage: coverage.get(r.id) ?? { sourceCount: 0, stale: r.stale },
			pointers: pointers.get(r.id) ?? [],
			compiledAt: r.compiledAt.toISOString(),
			compiledByModel: r.compiledByModel,
		});
	}
	return result;
}

/** Resolve a slug rename — returns the canonical page id or null. */
export async function findRedirect(oldSlug: string, collectionId: string | null): Promise<string | null> {
	const rows = await db
		.select({ newPageId: llmwikiPageRedirect.newPageId })
		.from(llmwikiPageRedirect)
		.where(
			collectionId === null
				? and(eq(llmwikiPageRedirect.oldSlug, oldSlug), isNull(llmwikiPageRedirect.collectionId))
				: and(
						eq(llmwikiPageRedirect.oldSlug, oldSlug),
						eq(llmwikiPageRedirect.collectionId, collectionId),
					),
		)
		.limit(1);
	return rows[0]?.newPageId ?? null;
}

/** Load the always-in-context overview page for a collection (or global). */
export async function getOverview(userId: string, collectionId: string | null): Promise<LlmwikiPage | null> {
	const rows = await db
		.select({
			id: llmwikiPage.id,
			slug: llmwikiPage.slug,
			title: llmwikiPage.title,
			tldr: llmwikiPage.tldr,
			body: llmwikiPage.body,
			tags: llmwikiPage.tags,
			stale: llmwikiPage.stale,
			compiledAt: llmwikiPage.compiledAt,
			compiledByModel: llmwikiPage.compiledByModel,
		})
		.from(llmwikiPage)
		.where(
			and(
				eq(llmwikiPage.userId, userId),
				eq(llmwikiPage.kind, 'overview'),
				isNull(llmwikiPage.deletedAt),
				collectionId === null ? isNull(llmwikiPage.collectionId) : eq(llmwikiPage.collectionId, collectionId),
			),
		)
		.limit(1);

	const row = rows[0];
	if (!row) return null;

	return {
		slug: row.slug,
		title: row.title,
		tldr: row.tldr,
		body: row.body,
		tags: row.tags,
		coverage: { sourceCount: 0, stale: row.stale },
		pointers: [],
		compiledAt: row.compiledAt.toISOString(),
		compiledByModel: row.compiledByModel,
	};
}
