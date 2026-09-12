/** Policy slice — the plan-gating predicate for the desk agent loop, and the step budget's last-step rule. */

export type { PlanPredicateInput } from './governor';
export { hasDestructiveIntent, requiresApproval, shouldRequirePlan } from './governor';
export { answerOnLastStep } from './step-budget';
