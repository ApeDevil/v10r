/**
 * Load shedding — under pressure, drop the work that matters least, on purpose.
 *
 * Every system has a load at which it cannot serve everything. The only choice is
 * whether the thing that gets dropped is chosen or arbitrary. Without shedding, the
 * queue decides: an analytics write and a sign-in wait in the same line, both get
 * slower, and past some point both fail. That is the worst available outcome, because
 * the analytics write was never worth a millisecond of the sign-in's latency.
 *
 * So the classes from `runtime.md` become an admission decision. `critical` is never
 * shed for load — when there is genuinely no room the bulkhead refuses it, and that
 * refusal is a visible 503 rather than a silent drop. `deferred` and `background` are
 * shed early and freely: they are, by their own definition, work the response does
 * not depend on.
 *
 * Two independent signals, because there are two ways to be out of room:
 *
 *   LOAD — how full the compartment is (`bulkhead.load`). Shedding thresholds sit
 *   BELOW the bulkhead's own limit deliberately: dropping optional work at 0.5 is how
 *   the pool avoids reaching 1.0 for the work that is not optional.
 *
 *   BUDGET — how much of the request's deadline is left. Work that cannot finish in
 *   the time remaining should not start; it will be abandoned anyway, having spent a
 *   slot to get there. An idle server with 20ms left on the clock is still the wrong
 *   place to begin a 200ms enrichment.
 *
 * The decision is a pure function of two numbers and it returns its reason, because a
 * shed that nobody can see is indistinguishable from a bug. Nothing here reads a
 * clock or a global — the caller supplies the signals, which is what makes both the
 * policy and its call sites testable.
 */

/** What the work is worth relative to the response. Same three classes as `runtime.md`. */
export type WorkPriority = 'critical' | 'deferred' | 'background';

export type ShedReason = 'admitted' | 'load' | 'budget';

export interface SheddingDecision {
	admit: boolean;
	reason: ShedReason;
	load: number;
	remainingMs: number;
}

export interface SheddingPolicy {
	name: string;
	/** Load (0–1) above which a class stops being admitted. Use 1 to never shed on load. */
	shedAbove: Record<WorkPriority, number>;
	/** Budget a class needs left to be worth starting. */
	needsMs: Record<WorkPriority, number>;
}

/**
 * Sane starting thresholds — a default to adapt, not a constant to inherit blindly.
 *
 * `critical: 1` is the load rule that says "never": load cannot exceed 1, so the
 * comparison can never fire, and the only thing that refuses critical work is the
 * bulkhead actually being full. Its `needsMs: 0` says the same in the budget axis —
 * critical work is attempted with whatever time is left, and the deadline decides.
 */
export const DEFAULT_SHED_ABOVE: Record<WorkPriority, number> = {
	critical: 1,
	deferred: 0.8,
	background: 0.5,
};

export const DEFAULT_NEEDS_MS: Record<WorkPriority, number> = {
	critical: 0,
	deferred: 50,
	background: 250,
};

export interface Shedder {
	readonly name: string;
	admit(priority: WorkPriority, signals: { load: number; remainingMs?: number }): SheddingDecision;
}

export function defineShedder(policy: SheddingPolicy): Shedder {
	return {
		name: policy.name,
		admit(priority, signals) {
			const load = signals.load;
			// No deadline supplied means no budget constraint to apply — Infinity says that
			// plainly, where a 0 default would shed everything the moment a caller forgot.
			const remainingMs = signals.remainingMs ?? Number.POSITIVE_INFINITY;

			if (load > policy.shedAbove[priority]) {
				return { admit: false, reason: 'load', load, remainingMs };
			}
			if (remainingMs < policy.needsMs[priority]) {
				return { admit: false, reason: 'budget', load, remainingMs };
			}
			return { admit: true, reason: 'admitted', load, remainingMs };
		},
	};
}
