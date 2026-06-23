/**
 * search_project_docs — semantic retrieval over the project's OWN documentation
 * (the docs/ markdown corpus, ingested into rag.* by scripts/db/ingest-docs.ts).
 *
 * This is the chatbot's door to "how does X actually work" — the deep prose the
 * quick-search catalog only indexes by title/FTS. It runs the existing tier-1
 * recursive-retrieval path (`retrieve`) over the system-owned docs corpus, so the
 * model gets the most relevant chunks by MEANING, not just keyword.
 *
 * Ownership: the docs corpus is owned by `SYSTEM_DOCS_USER_ID` (every retrieval
 * query hard-filters `user_id`), captured here in the closure — the model never
 * supplies it. Sibling to `search_catalog`: it feeds the SAME citation sink, so a
 * cited `/docs/...` path renders as a CitationChip and passes the surface verifier.
 *
 * Complements `search_catalog` (WHERE a surface lives) — this answers HOW/WHY from
 * the doc bodies. Returns nothing (not an error) when the corpus is empty.
 */

import { jsonSchema, tool } from 'ai';
import { and, eq, inArray } from 'drizzle-orm';
import type { SearchLocale, SearchResult } from '$lib/search/types';
import { SYSTEM_DOCS_USER_ID } from '$lib/server/config';
import { db } from '$lib/server/db';
import { document } from '$lib/server/db/schema/rag';
import { retrieve } from '$lib/server/rawrag';
import type { ToolMeta } from './_types';
import type { CatalogSink } from './search-catalog';

export const searchDocsToolMeta: Record<string, ToolMeta> = {
	search_project_docs: { risk: 'read' },
};

interface ToolInput {
	query: string;
	limit?: number;
}

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 8;
/** Per-chunk content budget handed to the model (chars). */
const SNIPPET_CHARS = 600;

export function createSearchDocsTool(locale: SearchLocale, sink?: CatalogSink) {
	return {
		search_project_docs: tool({
			description:
				'Search the project DOCUMENTATION (the docs/ knowledge base) by meaning and get back the ' +
				'most relevant passages plus the exact /docs path to cite. Use this to EXPLAIN how/why ' +
				'something works in this project — architecture, patterns, conventions, stack decisions ' +
				'(e.g. "how does the multi-client core work", "how is auth wired", "why Drizzle push-only"). ' +
				'For WHERE a page/component lives, use search_catalog instead. Ground your answer in the ' +
				'returned passages and only cite the /docs paths this tool returns; never invent one.',
			inputSchema: jsonSchema<ToolInput>({
				type: 'object',
				additionalProperties: false,
				properties: {
					query: {
						type: 'string',
						description: 'The concept or question to look up, e.g. "how does the RAG retrieval pipeline work".',
					},
					limit: {
						type: 'number',
						minimum: 1,
						maximum: MAX_LIMIT,
						description: `Max passages (default ${DEFAULT_LIMIT}).`,
					},
				},
				required: ['query'],
			}),
			execute: async ({ query, limit }) => {
				try {
					const q = typeof query === 'string' ? query.trim() : '';
					if (!q) return { results: [], error: 'query must be a non-empty string' };

					const cap = Math.min(Math.max(1, limit ?? DEFAULT_LIMIT), MAX_LIMIT);

					// Tier-1 semantic + lexical retrieval over the SYSTEM-owned docs corpus
					// (tier 1 is the retrieve() default).
					const result = await retrieve(q, { userId: SYSTEM_DOCS_USER_ID, maxChunks: cap });
					if (result.chunks.length === 0) return { results: [] };

					// Resolve each chunk's parent doc → canonical /docs path (the soft-pointer
					// stored as document.sourceUri at ingest time) for citation.
					const docIds = [...new Set(result.chunks.map((c) => c.documentId))];
					const docRows = await db
						.select({ id: document.id, sourceUri: document.sourceUri })
						.from(document)
						.where(and(inArray(document.id, docIds), eq(document.source, 'docs')));
					const pathById = new Map(docRows.map((r) => [r.id, r.sourceUri]));

					// Surface rows for the citation sink (chips + surface verifier) — only chunks
					// whose parent doc resolved to a real /docs path.
					const surfaced: SearchResult[] = [];
					const results = result.chunks.map((c) => {
						const path = pathById.get(c.documentId) ?? null;
						if (path) {
							surfaced.push({
								id: c.chunkId,
								surface: 'doc',
								title: c.documentTitle,
								path,
								anchor: null,
								breadcrumb: ['Docs'],
								snippet: c.content.slice(0, 140),
								highlight: [],
								locale: 'en',
								badge: locale === 'en' ? null : 'en-fallback',
								score: c.score,
							});
						}
						return {
							title: c.documentTitle,
							path,
							content: c.content.slice(0, SNIPPET_CHARS),
						};
					});

					if (surfaced.length > 0) sink?.record(surfaced);

					return { results };
				} catch (err) {
					console.error('[ai:tool:search_project_docs] failed:', err instanceof Error ? err.message : err);
					return { results: [], error: 'Docs search failed.' };
				}
			},
		}),
	};
}
