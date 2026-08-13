/**
 * llmwiki domain barrel.
 *
 * Cross-domain consumers import THIS barrel only — never a submodule path
 * like `$lib/server/llmwiki/search` (docs/codebase-organization.md,
 * Import-direction rule #3: "Cross-domain access is barrel-only"). Files
 * inside `llmwiki/` may still import siblings directly.
 */

export { COMPILE_SCAFFOLD } from './compile';
export {
	LLMWIKI_SEARCH_LIMIT,
	MAX_LLMWIKI_TOOL_IDS,
	MAX_RAWRAG_TOOL_CALLS_PER_TURN,
	MAX_RAWRAG_TOOL_IDS,
} from './config';
export { LINT_SCAFFOLD } from './lint';
export { loadOverview } from './overview';
export { countPages, fetchPagesByIds } from './queries';
export { searchLlmwiki } from './search';
export type * from './types';
export { verifyCitations } from './verify';
export { formatLlmwikiContext } from './wiki-format';
