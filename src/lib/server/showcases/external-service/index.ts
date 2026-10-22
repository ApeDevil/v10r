/**
 * External Service Lab — the server side of `/showcases/external-service`.
 *
 * A reference adapter to a separately deployed service (`services/order-rules`), scoped
 * to the showcase: nothing outside the route imports it (`isolation.gate.test.ts`), so
 * removing the service — or the whole showcase — cannot break anything else.
 */
export { callService, SERVICE_OPERATIONS, type ServiceCall } from './client';
export { CALL_CEILING_MS, RATE_LIMIT_MAX, RATE_LIMIT_PREFIX, RATE_LIMIT_WINDOW, RENDER_RESERVE_MS } from './config';
export { checkTarget, evaluateScenario, runDrill, type TargetCheck, toPublicServiceCall } from './lab';
export type { ResolvedServiceTarget, ServiceTarget } from './targets';
export { readServiceTargets } from './targets.adapter';
