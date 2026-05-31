/**
 * Plan-gating predicate for the desk agent loop.
 *
 * `shouldRequirePlan` decides whether a destructive multi-step turn must
 * produce a plan (via the `propose_plan` tool) before executing. Pure
 * function — no I/O.
 *
 * The `propose_plan` tool is registered in `tools/index.ts`; this predicate
 * is the intended trigger for forcing the `<planning>` block in the system
 * prompt (`context/system-prompt.ts` → `requirePlan`).
 *
 * Scope enforcement itself lives in the tool factory: `createDeskTools(userId,
 * scopes)` omits tools for scopes the caller wasn't granted, so out-of-scope
 * calls are impossible by construction rather than checked at runtime.
 */

/** Input for the plan-gating predicate. */
export interface PlanPredicateInput {
	destructiveIntent: boolean;
	destructiveToolCount: number;
	targetEntityCount: number;
}

/**
 * Decide whether a turn must produce a plan before executing.
 * Three-condition AND: destructive intent + >=2 destructive tools + >=2 targets.
 * The AND keeps one-shot interactions free of a planning latency tax.
 */
export function shouldRequirePlan(input: PlanPredicateInput): boolean {
	return input.destructiveIntent && input.destructiveToolCount >= 2 && input.targetEntityCount >= 2;
}
