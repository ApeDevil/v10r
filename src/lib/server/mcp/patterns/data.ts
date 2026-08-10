/**
 * The curated pattern registry, loaded for the HOSTED public MCP.
 *
 * Data source is the SAME `mcp/patterns.registry.json` the local stdio server reads — it is
 * the product. It enters here as a build-time static JSON import (Vite inlines it), which is
 * Vercel-safe and needs no runtime filesystem access. This module is server-only
 * (`$lib/server`), so the JSON never lands in a client bundle.
 *
 * Types mirror the stdio server's `mcp/registry.ts`. They are intentionally re-declared
 * rather than imported: `mcp/*.ts` must never be imported into `src/` (its Bun-only
 * `import.meta.dir` breaks svelte-check). Structural validity is guaranteed by the
 * `mcp:validate` gate that runs over the same file.
 */
import registryJson from '../../../../../mcp/patterns.registry.json';

export type RefKind = 'file' | 'dir' | 'route' | 'approute' | 'anchor';

/** `deep` = full emulation card (invariants + emulation notes); `light` = index row (pointers only). */
export type PatternTier = 'deep' | 'light';

export interface RegRef {
	path: string;
	note?: string;
	kind?: RefKind;
}

/** Meta-group for the generated Pattern Index TOC (Foundations, Data, …). */
export interface RegGroup {
	id: string;
	title: string;
}

/** Category = one generated Pattern Index section; registry order IS section order. */
export interface RegCategory {
	id: string;
	title: string;
	group: string;
}

export interface PatternRecord {
	id: string;
	tier: PatternTier;
	title: string;
	category: string;
	summary: string;
	when_to_use: string;
	capabilities: string[];
	keywords: string[];
	depends_on: string[];
	docs: RegRef[];
	code: RegRef[];
	tests: RegRef[];
	showcases: RegRef[];
	invariants: string[];
	emulation_notes: string[];
	risk: string;
}

export interface Registry {
	version: string;
	note?: string;
	groups: RegGroup[];
	categories: RegCategory[];
	patterns: PatternRecord[];
}

export const REGISTRY = registryJson as unknown as Registry;

export const PATTERNS: PatternRecord[] = REGISTRY.patterns;

export const CATEGORIES: RegCategory[] = REGISTRY.categories;

/** Deep tier only — the records that carry invariants/emulation notes (excerpt allowlist, DAG, plans). */
export const DEEP_PATTERNS: PatternRecord[] = PATTERNS.filter((pattern) => pattern.tier === 'deep');

export function buildById(): Map<string, PatternRecord> {
	return new Map(PATTERNS.map((pattern) => [pattern.id, pattern]));
}

/** Registry declaration order — the deterministic tie-breaker for scoring and topo-sort. */
export const REGISTRY_ORDER: string[] = PATTERNS.map((pattern) => pattern.id);
