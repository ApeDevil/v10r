/** Policy slice — the harness lens's "policy" primitive. See `docs/blueprint/ai/harness-lens.md`. */

export type {
	PolicyError,
	PolicyErrorAuditView,
	PolicyErrorClientView,
	PolicyErrorCode,
	PolicyErrorModelView,
} from './errors';
export {
	scopeDenied,
	toAuditView,
	toClientView,
	toModelView,
} from './errors';
export type { EffectivePolicy, PlanPredicateInput, PolicyInput } from './governor';
export {
	resolveEffectivePolicy,
	shouldRequirePlan,
	withGovernor,
} from './governor';
export type { SensorTrace } from './sensor';
export { drainTraces, getTrace, recordTrace, runWithSensor } from './sensor';
