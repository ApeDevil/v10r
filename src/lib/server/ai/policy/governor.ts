/**
 * Plan-gating predicate for the desk agent loop.
 *
 * `shouldRequirePlan` decides whether a destructive multi-step turn must
 * produce a plan (via the `desk_propose_plan` tool) before executing. Pure
 * function — no I/O.
 *
 * The tool is built by `createProposePlanTool` and wired in `tools/index.ts`;
 * this predicate is the trigger for forcing the `<planning>` block in the
 * system prompt (`context/system-prompt.ts` → `requirePlan`).
 *
 * Scope enforcement itself lives in the tool factory: `createDeskTools(userId,
 * scopes)` omits tools for scopes the caller wasn't granted, so out-of-scope
 * calls are impossible by construction rather than checked at runtime.
 */

import type { ToolRisk } from '$lib/server/ai/tools/_types';

/** Input for the plan-gating predicate. */
export interface PlanPredicateInput {
	/** The turn can mutate desk state — a write/create/delete scope is granted. */
	mutatingScopeGranted: boolean;
	/** The user's phrasing signals a destructive / overwrite / bulk operation. */
	destructiveIntent: boolean;
}

/**
 * Destructive-intent phrasing heuristic — the second input to `shouldRequirePlan`.
 * Shared by the chat orchestrator (real turns) and the context-probe endpoint
 * (the showcase x-ray), so what the probe reports is the production predicate.
 */
export function hasDestructiveIntent(text: string): boolean {
	return /\b(delete|remove|clear|wipe|purge|erase|drop|reset|overwrite|replace|bulk|all|every|each|multiple)\b/i.test(
		text,
	);
}

/**
 * Decide whether a turn should be *instructed* to plan first (inject the
 * `<planning>` block so the model batches its work into one `desk_propose_plan`).
 *
 * WIDENED: the old three-condition AND (>=2 tools + >=2 targets) let every
 * single-target destructive op — overwrite one doc, clear one sheet, delete one
 * file — skip planning entirely. That gate is gone. This is now soft guidance
 * only: the *hard* gate lives at the tool layer, where destructive/overwrite
 * tools return a `requiresApproval` sentinel instead of mutating, so the actual
 * mutation can only happen via the server-verified proposal approve-route replay.
 */
export function shouldRequirePlan(input: PlanPredicateInput): boolean {
	return input.mutatingScopeGranted && input.destructiveIntent;
}

/**
 * True when a desk tool's risk demands a human-approved proposal before it may
 * mutate. `write` (overwrites an existing entity) and `destructive` (delete /
 * unrecoverable) are gated; `read` and `create` (reversible via soft-delete) are
 * not. This is the single rule the tool layer and the orchestrator agree on.
 */
export function requiresApproval(risk: ToolRisk): boolean {
	return risk === 'write' || risk === 'destructive';
}
