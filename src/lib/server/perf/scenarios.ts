/**
 * The scenario harness — what the system does when conditions are not ideal.
 *
 * Localhost is fast, the cache is warm, the dependency answers, and nothing else is
 * running. Every number the observatory reports was taken under those conditions, which
 * is why they cannot answer the question that actually decides whether a system is fast
 * in production: what happens when one of those stops being true.
 *
 * Each scenario makes exactly one condition adverse, drives the REAL mechanism against
 * a simulated dependency, and reports two kinds of column:
 *
 *   Deterministic — origin calls and the outcome string. Same input, same value, every
 *   run, on any machine. These are asserted by `scenarios.gate.test.ts` against the
 *   committed results, so a behaviour change has to be a reviewed diff.
 *
 *   Reported — latency. It moves with the host, so gating it would be gating the CI
 *   runner's mood. It is committed anyway because the SHAPE is the finding: a slow
 *   dependency bounded at 60 ms instead of 400 is the whole claim, and a run where that
 *   stops being true is worth seeing in a diff even though no test can assert it.
 *
 * The harness runs with NO Redis on purpose (`sharedTier: false` in the results). A lab
 * measurement that depends on a network service's mood is not a lab measurement, and
 * every mechanism here has a defined in-process behaviour without it — which is itself
 * worth exercising, since that is what a preview deployment runs.
 *
 * Not everything in `docs/blueprint/velocity/measurement.md`'s scenario grid is covered.
 * Cold compute, slow network, large dataset and optimistic-mutation failure need a real
 * deployment, a real network and a browser respectively. The doc says which is which;
 * this file does not pretend the uncovered rows are green.
 */

import { cacheKey, clearLocalCache, coalesce, definePolicy, readTiered, redis, writeTiered } from '$lib/server/cache';
import { DeadlineExceededError, startDeadline } from '$lib/server/http/deadline';
import {
	DEFAULT_NEEDS_MS,
	DEFAULT_SHED_ABOVE,
	defineBreaker,
	defineBulkhead,
	defineShedder,
	ResilienceError,
	retryWithin,
} from '$lib/server/resilience';
import raw from './scenarios.json';

export const SCENARIO_IDS = [
	'cold-cache',
	'warm-cache',
	'expiry-burst',
	'slow-dependency',
	'failing-dependency',
	'concurrent-load',
	'retry-after-transient-failure',
	'refusal-not-retried',
	'shed-under-pressure',
] as const;

export type ScenarioId = (typeof SCENARIO_IDS)[number];

export interface ScenarioResult {
	id: ScenarioId;
	/** The single thing made adverse. */
	condition: string;
	/** Calls that reached the simulated dependency. Deterministic. */
	originCalls: number;
	/** What the mechanism did. Deterministic — this is the assertion. */
	outcome: string;
	/** Wall clock, rounded to a millisecond. Reported, never asserted. */
	latencyMs: number;
}

export interface ScenarioRun {
	generatedAt: string;
	/** Whether a shared cache tier was reachable. Always false for a committed run — see the header. */
	sharedTier: boolean;
	results: ScenarioResult[];
}

/** One unit of simulated dependency work. Long enough to measure, short enough to run in a gate. */
const ORIGIN_MS = 20;
/** A dependency that has stopped answering, as opposed to one that is merely slow. */
const HANGING_MS = 400;
/** The slice a caller is willing to wait for one dependency call. */
const SLICE_MS = 60;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A dependency that counts how often it was actually reached. */
function simulatedOrigin(costMs = ORIGIN_MS) {
	let calls = 0;
	return {
		get calls() {
			return calls;
		},
		async call<T>(value: T): Promise<T> {
			calls++;
			await sleep(costMs);
			return value;
		},
	};
}

async function measure(work: () => Promise<{ originCalls: number; outcome: string }>) {
	const from = performance.now();
	const { originCalls, outcome } = await work();
	return { originCalls, outcome, latencyMs: Math.round(performance.now() - from) };
}

const CACHE_POLICY = definePolicy({ namespace: 'scenario', ttl: 60, scope: 'shared' });

const SCENARIOS: Record<
	ScenarioId,
	{ condition: string; run: () => Promise<{ originCalls: number; outcome: string }> }
> = {
	'cold-cache': {
		condition: 'nothing cached — the first caller after a deploy',
		async run() {
			clearLocalCache();
			const origin = simulatedOrigin();
			const key = cacheKey(CACHE_POLICY, { id: 'cold' });

			const hit = await readTiered<string>(CACHE_POLICY, key);
			if (!hit) await writeTiered(CACHE_POLICY, key, await origin.call('value'));

			return { originCalls: origin.calls, outcome: hit ? 'unexpected-hit' : 'origin-miss' };
		},
	},

	'warm-cache': {
		condition: 'the same read, immediately after — the ordinary case',
		async run() {
			const origin = simulatedOrigin();
			const key = cacheKey(CACHE_POLICY, { id: 'cold' });

			// Deliberately reuses `cold-cache`'s key and does NOT clear the local tier:
			// "warm" is a fact about what the previous scenario left behind, and
			// re-seeding it here would measure a write, not a hit.
			const hit = await readTiered<string>(CACHE_POLICY, key);
			if (!hit) await origin.call('value');

			return { originCalls: origin.calls, outcome: hit ? `${hit.tier}-hit` : 'unexpected-miss' };
		},
	},

	'expiry-burst': {
		condition: '50 callers arrive on the same key the moment it expires',
		async run() {
			const origin = simulatedOrigin();
			const key = `scenario-burst-${crypto.randomUUID()}`;

			await Promise.all(Array.from({ length: 50 }, () => coalesce(key, () => origin.call('value'))));

			return { originCalls: origin.calls, outcome: `coalesced-50-to-${origin.calls}` };
		},
	},

	'slow-dependency': {
		condition: `a dependency that takes ${HANGING_MS}ms against a ${SLICE_MS}ms slice`,
		async run() {
			const origin = simulatedOrigin(HANGING_MS);
			const deadline = startDeadline(1_000);

			let outcome = 'unbounded';
			try {
				await deadline.child(SLICE_MS).run(() => origin.call('value'));
				outcome = 'returned-late';
			} catch (error) {
				// The point is not that it failed. It is that the caller got an answer at
				// SLICE_MS instead of waiting out a dependency that had already lost them.
				outcome = error instanceof DeadlineExceededError ? 'deadline-exceeded' : 'unexpected-error';
			}

			return { originCalls: origin.calls, outcome };
		},
	},

	'failing-dependency': {
		condition: '12 callers against a dependency that is down, breaker threshold 3',
		async run() {
			const breaker = defineBreaker({
				name: 'scenario',
				openForSeconds: 30,
				failureThreshold: 3,
				failureWindowSeconds: 30,
			});
			const subject = crypto.randomUUID();
			let calls = 0;

			for (let caller = 0; caller < 12; caller++) {
				if (await breaker.isOpen(subject)) continue;
				calls++;
				await breaker.recordFailure(subject);
			}

			return { originCalls: calls, outcome: `open-after-${calls}-of-12` };
		},
	},

	'concurrent-load': {
		condition: '20 simultaneous callers against a pool of 4 with room for 4 more',
		async run() {
			const bulkhead = defineBulkhead({ name: 'scenario', maxConcurrent: 4, maxQueued: 4 });
			const origin = simulatedOrigin();

			const settled = await Promise.allSettled(
				Array.from({ length: 20 }, () => bulkhead.run(() => origin.call('value'))),
			);
			const refused = settled.filter((s) => s.status === 'rejected').length;

			// Refusing beyond capacity is the behaviour under test. An unbounded queue
			// would admit all 20 and hand every one of them a latency nobody can state.
			return { originCalls: origin.calls, outcome: `admitted-${20 - refused}-refused-${refused}` };
		},
	},

	'retry-after-transient-failure': {
		condition: 'a dependency that fails twice, then answers',
		async run() {
			const deadline = startDeadline(1_000);
			let calls = 0;

			await retryWithin(deadline, { attempts: 4, baseDelayMs: 5, maxDelayMs: 20, attemptMaxMs: 200 }, async () => {
				calls++;
				if (calls < 3) throw new Error('transient');
				return 'value';
			});

			return { originCalls: calls, outcome: `succeeded-on-attempt-${calls}` };
		},
	},

	'refusal-not-retried': {
		condition: 'a dependency that refuses — a full bulkhead, not a failure',
		async run() {
			const deadline = startDeadline(1_000);
			let calls = 0;

			try {
				await retryWithin(deadline, { attempts: 5, baseDelayMs: 5, maxDelayMs: 20 }, async () => {
					calls++;
					throw new ResilienceError('bulkhead_full', 'no capacity');
				});
			} catch {
				// Expected. A refusal does not become a success by being asked again, and
				// retrying one is how a busy system is turned into an overloaded one.
			}

			return { originCalls: calls, outcome: `attempted-${calls}-of-5` };
		},
	},

	'shed-under-pressure': {
		condition: 'load at 0.6 with 30ms of budget left',
		async run() {
			const shedder = defineShedder({ name: 'scenario', shedAbove: DEFAULT_SHED_ABOVE, needsMs: DEFAULT_NEEDS_MS });
			// Chosen so both axes fire in one scenario: 0.6 is under the deferred load
			// threshold but over the background one, and 30ms is under what deferred work
			// needs to be worth starting. A single signal would only ever prove one rule.
			const signals = { load: 0.6, remainingMs: 30 };

			const verdicts = (['critical', 'deferred', 'background'] as const).map(
				(priority) => `${priority}:${shedder.admit(priority, signals).reason}`,
			);

			// No dependency is called at all — that IS the mechanism. Shedding is the only
			// Velocity pattern whose success looks like nothing happening.
			return { originCalls: 0, outcome: verdicts.join(' ') };
		},
	},
};

/** Run every scenario in declaration order. Order matters: `warm-cache` reads what `cold-cache` left. */
export async function runScenarios(): Promise<ScenarioRun> {
	const results: ScenarioResult[] = [];

	for (const id of SCENARIO_IDS) {
		const { condition, run } = SCENARIOS[id];
		results.push({ id, condition, ...(await measure(run)) });
	}

	return { generatedAt: new Date().toISOString(), sharedTier: redis !== null, results };
}

/**
 * The committed run — the accepted behaviour, in the same spirit as `snapshot.json`.
 *
 * Regenerate with `bun run perf:scenarios` after a deliberate change; the gate compares
 * a fresh run's deterministic columns against this and fails on any difference, so a
 * behaviour change arrives as a reviewed diff rather than as a number nobody noticed.
 */
export const committedScenarios = raw as ScenarioRun;

export interface ScenarioDrift {
	id: ScenarioId;
	/** null when the committed run does not contain this scenario at all. */
	committed: { originCalls: number; outcome: string } | null;
	fresh: { originCalls: number; outcome: string };
	changed: boolean;
}

/** Compare a fresh run's deterministic columns against the committed ones. */
export function compareScenarios(fresh: ScenarioRun, accepted: ScenarioRun = committedScenarios): ScenarioDrift[] {
	return fresh.results.map((result) => {
		const match = accepted.results.find((r) => r.id === result.id) ?? null;
		const committed = match ? { originCalls: match.originCalls, outcome: match.outcome } : null;
		const current = { originCalls: result.originCalls, outcome: result.outcome };
		return {
			id: result.id,
			committed,
			fresh: current,
			changed: !committed || committed.originCalls !== current.originCalls || committed.outcome !== current.outcome,
		};
	});
}
