/**
 * search_pattern_library — model looks up the canonical v10r pattern registry
 * (the SAME `mcp/patterns.registry.json` both MCP runtimes serve) and gets back
 * pattern records with their citable `/docs/pattern-library/<id>` page.
 *
 * Named `search_pattern_library`, NOT `search_patterns` — that name is the live
 * MCP tool on the hosted + stdio surfaces, and reusing it here would make prose,
 * admin dashboards, and telemetry ambiguous about which tool ran.
 *
 * Pure and zero-I/O like `search_catalog`: `scorePatterns` over the static
 * registry import — no embedding, no DB round-trip, no drift from the MCP.
 * Deep-tier rows carry invariants + emulation notes (bounded: ≤11 deep records
 * exist); light rows are index pointers. The optional `sink` records surfaced
 * rows so the orchestrator can ground citation chips exactly as it does for
 * `search_catalog` / `search_project_docs`.
 */

import { jsonSchema, tool } from 'ai';
import type { SearchLocale, SearchResult } from '$lib/search/types';
import { CATEGORIES, PATTERNS, type PatternRecord } from '$lib/server/mcp/patterns/data';
import { scorePatterns } from '$lib/server/mcp/patterns/search';
import type { CatalogSink } from './search-catalog';

interface ToolInput {
	query: string;
	category?: string;
	limit?: number;
}

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 8;

/** Tokens that signal "list everything" rather than a keyword search. */
const BROWSE_TOKENS = new Set(['*', 'all', '_', 'list', 'everything', '.*', '%']);

const PAGES_BASE = '/docs/pattern-library';

function toRow(pattern: PatternRecord) {
	return {
		id: pattern.id,
		title: pattern.title,
		category: pattern.category,
		tier: pattern.tier,
		summary: pattern.summary,
		when_to_use: pattern.when_to_use,
		path: `${PAGES_BASE}/${pattern.id}`,
		docs: pattern.docs.map((ref) => ref.path),
		showcases: pattern.showcases.map((ref) => ref.path),
		// Deep-only depth: at most ~11 records carry these, so the context cost is
		// bounded — and they are this tool's unique value over plain doc search.
		...(pattern.tier === 'deep' ? { invariants: pattern.invariants, emulation_notes: pattern.emulation_notes } : {}),
	};
}

function toSinkRow(pattern: PatternRecord, locale: SearchLocale, score: number): SearchResult {
	return {
		id: `pattern:${pattern.id}`,
		surface: 'doc',
		title: pattern.title,
		path: `${PAGES_BASE}/${pattern.id}`,
		anchor: null,
		breadcrumb: ['Docs', 'Pattern Library'],
		snippet: pattern.summary.slice(0, 140),
		highlight: [],
		locale,
		badge: locale === 'en' ? null : 'en-fallback',
		score,
	};
}

export function createSearchPatternLibraryTool(locale: SearchLocale, sink?: CatalogSink) {
	return {
		search_pattern_library: tool({
			description:
				'Look up the canonical v10r PATTERN registry — the curated map of every proven pattern in this ' +
				'project (136 records: deep cards with invariants/emulation notes, plus index rows). Use it when ' +
				'the user asks WHICH pattern covers a capability, what patterns exist, or how to emulate one ' +
				'(e.g. "which pattern covers rate limiting", "what AI patterns does v10r have"). ' +
				'To list a whole category pass query "*" with `category`. Cite the returned `path` ' +
				'(/docs/pattern-library/<id>) when referencing a pattern. For WHERE a page lives use ' +
				'search_catalog; for prose explanations use search_project_docs.',
			inputSchema: jsonSchema<ToolInput>({
				type: 'object',
				additionalProperties: false,
				properties: {
					query: {
						type: 'string',
						description:
							'Capability, feature, or concept to find a pattern for — e.g. "background jobs" or "captcha". Pass "*" to browse.',
					},
					category: {
						type: 'string',
						description:
							'Optional exact category filter — a category id from any result, e.g. "ai", "analytics", "app-shell".',
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
			execute: async ({ query, category, limit }) => {
				try {
					const q = typeof query === 'string' ? query.trim() : '';
					const cap = Math.min(Math.max(1, limit ?? DEFAULT_LIMIT), MAX_LIMIT);
					if (category !== undefined && !CATEGORIES.some((entry) => entry.id === category)) {
						return {
							results: [],
							error: `Unknown category "${category}". Valid: ${CATEGORIES.map((entry) => entry.id).join(', ')}.`,
						};
					}
					const pool = category ? PATTERNS.filter((pattern) => pattern.category === category) : PATTERNS;

					// Browse/enumerate: registry order (deep-first within category by construction).
					if (q === '' || BROWSE_TOKENS.has(q.toLowerCase())) {
						const browsed = pool.slice(0, cap);
						sink?.record(browsed.map((pattern) => toSinkRow(pattern, locale, 0)));
						return { results: browsed.map(toRow), total: pool.length };
					}

					const scored = scorePatterns(q, pool).slice(0, cap);
					sink?.record(scored.map((hit) => toSinkRow(hit.pattern, locale, hit.score)));
					return { results: scored.map((hit) => toRow(hit.pattern)) };
				} catch (err) {
					console.error('[ai:tool:search_pattern_library] failed:', err instanceof Error ? err.message : err);
					return { results: [], error: 'Pattern search failed.' };
				}
			},
		}),
	};
}
