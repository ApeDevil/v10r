import {
	BREAKER_CALLERS,
	CHAIN_STEPS,
	FAILING_MS,
	POOL_SIZE,
	RUN_BUDGET_MS,
	SLOW_CALLERS,
	SLOW_MS,
	STEP_TIMEOUT_MS,
} from '$lib/server/showcases/velocity';
import type { PageServerLoad } from './$types';

/**
 * Deliberately measures nothing, for the same reason the Data tab does not: every
 * panel here spends real time failing, queueing or hanging on purpose, and a page
 * about latency that makes you wait for its own first byte is arguing against itself.
 * The load hands over the constants; the measurements run when the visitor asks.
 */
export const load: PageServerLoad = () => ({
	title: 'Runtime - Velocity - Showcases',
	breakerCallers: BREAKER_CALLERS,
	failingMs: FAILING_MS,
	poolSize: POOL_SIZE,
	slowCallers: SLOW_CALLERS,
	slowMs: SLOW_MS,
	chainSteps: CHAIN_STEPS,
	stepTimeoutMs: STEP_TIMEOUT_MS,
	runBudgetMs: RUN_BUDGET_MS,
});
