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

export type RefKind = 'file' | 'dir' | 'route' | 'anchor';

export interface RegRef {
	path: string;
	note?: string;
	kind?: RefKind;
}

export interface PatternRecord {
	id: string;
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
	patterns: PatternRecord[];
}

export const REGISTRY = registryJson as unknown as Registry;

export const PATTERNS: PatternRecord[] = REGISTRY.patterns;

export function buildById(): Map<string, PatternRecord> {
	return new Map(PATTERNS.map((pattern) => [pattern.id, pattern]));
}

/** Registry declaration order — the deterministic tie-breaker for scoring and topo-sort. */
export const REGISTRY_ORDER: string[] = PATTERNS.map((pattern) => pattern.id);
