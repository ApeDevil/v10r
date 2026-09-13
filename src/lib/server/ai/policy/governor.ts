/**
 * The approval rule of the desk agent loop — the one predicate the tool layer and the
 * orchestrator agree on. Pure function, no I/O.
 *
 * Scope enforcement itself lives in the profile: a desk capability mounts its tools only
 * when its scope is granted (`capabilities/desk-scope.ts`), so out-of-scope calls are
 * impossible by construction rather than checked at runtime. The soft plan-first guidance
 * (`shouldRequirePlan`, the `<planning>` guide) is the `desk-plan` capability's.
 */

import type { ToolRisk } from '$lib/server/ai/tools/_types';

/**
 * True when a desk tool's risk demands a human-approved proposal before it may
 * mutate. `write` (overwrites an existing entity) and `destructive` (delete /
 * unrecoverable) are gated; `read` and `create` (reversible via soft-delete) are
 * not.
 */
export function requiresApproval(risk: ToolRisk): boolean {
	return risk === 'write' || risk === 'destructive';
}
