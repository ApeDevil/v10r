/**
 * The pattern library as the app sees it.
 *
 * The registry is the product; `mcp/` (stdio) and `server/mcp/` (hosted HTTP) are two
 * transports over it, and the generated `/docs/pattern-library` pages are a third reader.
 * All of them share one type declaration in `$patterns/schema` — the app used to re-declare
 * `PatternRecord` here, which is the kind of copy that silently drifts.
 *
 * The JSON enters as a build-time static import (Vite inlines it): Vercel-safe, no runtime
 * filesystem access. This module is under `$lib/server`, so it never reaches a client bundle.
 */
import registryJson from '$patterns/registry.json';
import type { PatternRecord, RegCategory, Registry } from '$patterns/schema';

export type {
	PatternMaturity,
	PatternRecord,
	PatternTier,
	RefKind,
	RegCategory,
	RegGroup,
	Registry,
	RegRef,
} from '$patterns/schema';

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
