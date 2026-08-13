/** Policy slice — the plan-gating predicate for the desk agent loop. */

export type { PlanPredicateInput } from './governor';
export { hasDestructiveIntent, requiresApproval, shouldRequirePlan } from './governor';
