/**
 * The pattern library — this project's product surface, served three ways.
 *
 * `registry.ts` owns the data (one static import of `$patterns/registry.json`),
 * `catalog.ts` projects it for the live `/docs/pattern-library` hub, and `render.ts`
 * generates the committed Markdown pages. The hosted MCP (`server/mcp/patterns/`) and
 * the AI `search_pattern_library` tool read through this barrel.
 */
export { buildCatalog, type Catalog, type CatalogCategory, type CatalogGroup, type CatalogPattern } from './catalog';
export {
	buildById,
	CATEGORIES,
	DEEP_PATTERNS,
	PATTERNS,
	type PatternMaturity,
	type PatternRecord,
	type PatternTier,
	REGISTRY,
	REGISTRY_ORDER,
	type RefKind,
	type RegCategory,
	type RegGroup,
	type Registry,
	type RegRef,
} from './registry';
export {
	anchorFor,
	docsUrlFor,
	frontmatterDescription,
	PATTERN_PAGES_DIR,
	README_MARKER_END,
	README_MARKER_START,
	type RenderOpts,
	renderPatternPage,
	renderPatternsHub,
	renderReadmeIndex,
} from './render';
