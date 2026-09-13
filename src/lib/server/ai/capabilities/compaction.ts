/**
 * compaction — the escape hatch of the tool loop's result budget (AI SDK #9631 workaround).
 *
 * A tool result above the budget is replaced, at execute time, by a `{ ref, summary,
 * truncated, originalBytes, hint }` projection (`loop/compact.ts`); `resolve_ref` is the
 * model's one route back to the full value. Compaction runs at execute time rather than in
 * `prepareStep` because the SDK silently drops message mutations returned from there.
 * Listed last in every profile: it mounts only when something else did.
 */
import type { ToolSet } from 'ai';
import { type CompactedResult, compactToolResult } from '../loop/compact';
import type { AssistantCapability } from '../profile/profile';
import { createResolveRefTool } from '../tools/resolve-ref';

/** Told each time a tool result is replaced by a ref before the model sees it. */
export type CompactionListener = (toolName: string, compaction: { ref: string; originalBytes: number }) => void;

/**
 * Tools whose output must reach the loop verbatim. `resolve_ref` returns the full value
 * behind a ref — compacting it again would hand the model a new ref for the same value,
 * forever. `desk_propose_plan` returns the approval sentinel the orchestrator persists
 * as the proposal; a compacted plan would approve a 400-character preview of itself.
 */
const COMPACTION_EXEMPT_TOOLS: ReadonlySet<string> = new Set(['resolve_ref', 'desk_propose_plan']);

/**
 * Wrap every tool's `execute` so its return value passes through `compactToolResult`
 * before the AI SDK sees it. `onCompacted` hears about each replacement, so the turn
 * trace can show the ref as the model's route back to the full value.
 */
export function wrapToolsWithCompaction(tools: ToolSet, onCompacted?: CompactionListener): ToolSet {
	const wrapped: Record<string, unknown> = {};
	for (const [name, toolDef] of Object.entries(tools)) {
		const def = toolDef as Record<string, unknown>;
		const originalExecute = def.execute as ((...args: unknown[]) => Promise<unknown>) | undefined;
		if (!originalExecute || COMPACTION_EXEMPT_TOOLS.has(name)) {
			wrapped[name] = toolDef;
			continue;
		}
		wrapped[name] = {
			...def,
			execute: async (...args: unknown[]) => {
				const result = await originalExecute(...args);
				const compacted = compactToolResult(name, result);
				if (compacted !== result) {
					const { ref, originalBytes } = compacted as CompactedResult;
					onCompacted?.(name, { ref, originalBytes });
				}
				return compacted;
			},
		};
	}
	return wrapped as ToolSet;
}

export const compaction: AssistantCapability = {
	id: 'compaction',
	when: 'any other tool is mounted this turn',
	activates: (turn) =>
		turn.hasTools ? { active: true } : { active: false, reason: turn.toolsCooled ? 'providers_cooled' : 'no_tools' },
	tools: (_turn, state) => (Object.keys(state.tools).length > 0 ? createResolveRefTool() : {}),
};
