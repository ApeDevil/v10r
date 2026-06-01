/**
 * search_catalog — model looks up the project's quick-search catalog (pages,
 * showcases/components, doc sections, blog posts) and gets back EXACT canonical
 * paths it may cite. This is the chatbot's authoritative door to the surfaces the
 * ⌘K palette already knows; it composes the SAME in-process catalog the palette
 * and `/api/search` use — no embedding, no separate index, no drift.
 *
 * Deterministic & read-only: the static lane (`buildSearchIndex` → `match`) covers
 * page/showcase/section/doc titles; the server lane (`searchContent`) adds doc
 * bodies + live blog FTS. Results are deduped (server hit wins — richer snippet).
 *
 * `locale` and `authCeiling` are captured in the closure — the model cannot forge
 * them. The optional `sink` records the full surfaced rows so the orchestrator can
 * (a) ground citation chips and (b) run the surface verifier. No `userId` needed:
 * the catalog is project-global and visibility is governed by `authCeiling`.
 */

import { jsonSchema, tool } from 'ai';
import { match } from '$lib/search/match';
import type { SearchLocale, SearchResult, SearchSurface } from '$lib/search/types';
import { buildSearchIndex, searchContent } from '$lib/server/search';
import type { DeskToolMeta } from './_types';

export const searchCatalogToolMeta: Record<string, DeskToolMeta> = {
	search_catalog: { risk: 'read', scope: 'desk:read' },
};

/** Side-channel that captures the full `SearchResult` rows surfaced this turn. */
export interface CatalogSink {
	record(rows: SearchResult[]): void;
}

interface ToolInput {
	query: string;
	surface?: SearchSurface | null;
	limit?: number;
}

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 8;

/** Auth scopes a given role may see. Today every record is `public`, so this is a
 * structural no-op gate — but it keeps the bot honest if user/admin surfaces appear. */
function allowedScopes(authCeiling: string | null): Set<SearchRecordScope> {
	if (authCeiling === 'admin') return new Set(['public', 'user', 'admin']);
	if (authCeiling) return new Set(['public', 'user']);
	return new Set(['public']);
}

type SearchRecordScope = 'public' | 'user' | 'admin';

/** `surface:path:anchor` — the dedupe key shared with the palette + /search merge. */
function dedupeKey(r: SearchResult): string {
	return `${r.surface}:${r.path}:${r.anchor ?? ''}`;
}

/** Coarse `scope` for the server lane; only `doc`/`blog`/all reach `searchContent`. */
function scopeFor(surface: SearchSurface | null | undefined): 'all' | 'docs' | 'blog' {
	if (surface === 'doc') return 'docs';
	if (surface === 'blog') return 'blog';
	return 'all';
}

export function createSearchCatalogTool(locale: SearchLocale, authCeiling: string | null, sink?: CatalogSink) {
	return {
		search_catalog: tool({
			description:
				'Find existing pages, showcase/component demos, doc sections, and blog posts in this ' +
				'project and return their EXACT canonical paths. Use this to locate a surface or to cite ' +
				'a link (e.g. "where is the Button component", "what domains exist", "blog posts about RAG"). ' +
				'This is the SAME index that powers the site search palette. ' +
				'Use ONLY to find WHERE something lives — do NOT use it to explain how something works ' +
				'internally (use get_llmwiki_pages for that). Only cite paths this tool returns; never invent one.',
			inputSchema: jsonSchema<ToolInput>({
				type: 'object',
				additionalProperties: false,
				properties: {
					query: {
						type: 'string',
						description: 'What to find. Natural language or keywords, e.g. "switch component" or "drizzle push".',
					},
					surface: {
						// Plain scalar enum — Groq's constrained tool-call decoder rejects array
						// (`['string','null']`) types and `null` enum members. The param is optional,
						// so OMITTING it already means "all surfaces" (execute coerces to null).
						type: 'string',
						enum: ['page', 'showcase', 'section', 'doc', 'blog'],
						description:
							'Restrict to one surface. Omit to search all. Use "showcase" for component/feature demos, ' +
							'"doc" for documentation, "blog" for articles, "page" for top-level routes.',
					},
					limit: {
						type: 'number',
						minimum: 1,
						maximum: MAX_LIMIT,
						description: `Max results (default ${DEFAULT_LIMIT}).`,
					},
				},
				required: ['query'],
			}),
			execute: async ({ query, surface, limit }) => {
				try {
					const q = typeof query === 'string' ? query.trim() : '';
					if (!q) return { results: [], error: 'query must be a non-empty string' };

					const cap = Math.min(Math.max(1, limit ?? DEFAULT_LIMIT), MAX_LIMIT);
					const scopes = allowedScopes(authCeiling);
					const wantSurface = surface ?? null;

					// Static lane — page/showcase/section/doc titles, the only lane carrying authScope.
					const records = buildSearchIndex(locale).filter(
						(r) => scopes.has(r.authScope) && (!wantSurface || r.surface === wantSurface),
					);
					const staticHits = match(records, q, cap);

					// Server lane — doc bodies + live blog FTS (snippets). Skipped for page/showcase/section.
					const needsServer = wantSurface === null || wantSurface === 'doc' || wantSurface === 'blog';
					const serverHits = needsServer
						? await searchContent(q, { locale, limit: cap, scope: scopeFor(wantSurface) })
						: [];

					// Merge: server hit wins (richer snippet), mirroring the palette/`/search` merge.
					const byKey = new Map<string, SearchResult>();
					for (const r of staticHits) byKey.set(dedupeKey(r), r);
					for (const r of serverHits) byKey.set(dedupeKey(r), r);

					const merged = Array.from(byKey.values())
						.sort((a, b) => b.score - a.score)
						.slice(0, cap);

					sink?.record(merged);

					return {
						results: merged.map((r) => ({
							surface: r.surface,
							title: r.title,
							path: r.path,
							anchor: r.anchor,
							breadcrumb: r.breadcrumb,
							snippet: r.snippet ? r.snippet.slice(0, 140) : null,
							icon: r.icon,
							badge: r.badge,
						})),
					};
				} catch (err) {
					console.error('[ai:tool:search_catalog] failed:', err instanceof Error ? err.message : err);
					return { results: [], error: 'Catalog search failed.' };
				}
			},
		}),
	};
}
