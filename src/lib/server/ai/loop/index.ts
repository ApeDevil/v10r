/** Loop slice — the harness lens's "loop" primitive. See `docs/blueprint/ai/harness-lens.md`. */

export type { CompactedResult, CompactionBudget } from './compact';
export {
	compactToolResult,
	compactToolResults,
	DEFAULT_BUDGET,
	projectSummary,
	resolveRef,
	runWithCompaction,
} from './compact';
