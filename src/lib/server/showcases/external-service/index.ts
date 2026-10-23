/**
 * External Service Lab — the server side of `/showcases/external-service`.
 *
 * A reference service client for a separately deployed service (`services/runtime-lab`),
 * scoped to the showcase: nothing outside the route imports it (`isolation.gate.test.ts`),
 * so removing the service — or the whole showcase — cannot break anything else. In a
 * product, `client.ts`, `contract.ts`, `targets.ts`, `targets.adapter.ts` and `config.ts`
 * would form a domain named for the service; `lab.ts` and `presets.ts` are demo code.
 */
export { callService, SERVICE_OPERATIONS, type ServiceCall } from './client';
export {
	CALL_CEILING_MS,
	GLOBAL_RATE_LIMIT_MAX,
	GLOBAL_RATE_LIMIT_POLICY,
	GLOBAL_RATE_LIMIT_PREFIX,
	RATE_LIMIT_MAX,
	RATE_LIMIT_POLICY,
	RATE_LIMIT_PREFIX,
	RATE_LIMIT_WINDOW,
	RENDER_RESERVE_MS,
	WAKE_CEILING_MS,
} from './config';
export { checkTarget, evaluatePreset, runDrill, toPublicServiceCall } from './lab';
export type { ResolvedServiceTarget, ServiceTarget } from './targets';
export { readServiceTargets } from './targets.adapter';
