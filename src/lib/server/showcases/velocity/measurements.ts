/**
 * The Velocity showcase's evidence: two arms of the same work, actually executed.
 *
 * Every number this returns was measured on the request that asked for it — a
 * `performance.now()` pair around real `await`s, running the real
 * `$lib/server/cache` code. Nothing here is a stored figure or an animation timed
 * to look convincing. That is the point of the page: a claim about latency is worth
 * exactly as much as the measurement behind it.
 *
 * What IS simulated is the dependency. `simulatedOrigin` sleeps for `ORIGIN_MS`
 * instead of querying Postgres, for three reasons: a public page must not be able to
 * put load on the database (Neon's free tier is 100 CU-h for the whole project, and a
 * showcase has taken it down before), a fixed cost makes the two arms comparable, and
 * a real query's variance would drown the effect being demonstrated. The mechanisms
 * under test — coalescing, the cache tiers, concurrency, deferral — are the genuine
 * article; only the thing they are wrapped around is a stand-in, and the page says so.
 *
 * `originCalls` is usually the more honest of the two figures. Concurrency can make
 * a hundred rebuilds finish in about the wall-clock time of one while still costing a
 * hundred round trips upstream; the count is what the dependency actually felt.
 */
import { coalesce, definePolicy, readThrough } from '$lib/server/cache';
import { startDeadline } from '$lib/server/http/deadline';
import type { RequestTiming } from '$lib/server/http/request-timing';
import { defineBreaker, defineBulkhead } from '$lib/server/resilience';
import type { VelocityMeasurement, VelocityMeasurementId } from '$lib/showcases/velocity/measurement';

/**
 * Cost of one simulated dependency call.
 *
 * Small enough that running every measurement is not itself a slow page, large
 * enough to sit well clear of scheduler noise.
 */
export const ORIGIN_MS = 60;

/**
 * How long the stale-while-revalidate measurement waits for a 1s TTL to lapse.
 *
 * The margin over 1000ms is not padding — the stored horizon is whole seconds and the
 * write happened a few milliseconds into one, so a read at exactly 1000ms is a coin toss
 * between fresh and stale, and a coin toss is not a demonstration.
 */
export const EXPIRY_WAIT_MS = 1200;

/** How many concurrent readers the stampede measurement fans out to. */
export const STAMPEDE_CALLERS = 100;

/** How long the broken dependency takes to fail. A refusal is not free; a timeout is worse. */
export const FAILING_MS = 80;

/** Callers who meet the broken dependency, one after another. */
export const BREAKER_CALLERS = 6;

/** Failures the breaker tolerates before it stops asking. */
export const BREAKER_THRESHOLD = 3;

/** Slots in the shared pool the bulkhead measurement contends for. */
export const POOL_SIZE = 4;

/** Calls the slow capability makes into that pool. */
export const SLOW_CALLERS = 8;

/** Cost of one call to the slow capability. */
export const SLOW_MS = 100;

/** Steps in the deadline measurement's chain of dependencies. */
export const CHAIN_STEPS = 3;

/** The per-step timeout the naive arm picks, in isolation, for each of them. */
export const STEP_TIMEOUT_MS = 100;

/** The whole-operation budget the velocity arm divides between those same steps. */
export const RUN_BUDGET_MS = 150;

/**
 * The smallest slice worth spending on a step.
 *
 * Without a floor, "the budget ran out" is a boundary condition rather than a
 * decision: the last step gets a fraction of a millisecond, starts anyway, and is
 * abandoned before it can return. Every leaf under a deadline needs a number like this
 * — the point at which starting the call is knowably pure waste.
 */
export const MIN_STEP_MS = 20;

/** A dependency slow enough that every timeout in this file fires. */
const HANGING_MS = 400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A dependency that costs what a real one costs, and counts how often it was asked. */
function simulatedOrigin(counter: { calls: number }, costMs = ORIGIN_MS) {
	return async <T>(value: T): Promise<T> => {
		counter.calls++;
		await sleep(costMs);
		return value;
	};
}

/**
 * A dependency that is down.
 *
 * It still costs what a healthy one costs before failing, which is the entire point:
 * an unhealthy dependency is expensive precisely because discovering that it is
 * unhealthy takes as long as a successful call, every single time.
 */
function brokenOrigin(counter: { calls: number }) {
	return async (): Promise<never> => {
		counter.calls++;
		await sleep(FAILING_MS);
		throw new Error('dependency unavailable');
	};
}

/**
 * Time an arm THROUGH the request's tracer rather than a private clock.
 *
 * The page's numbers and the response's `Server-Timing` header are then the same
 * measurement, which is the point: a showcase about latency attribution that kept its
 * own private stopwatch would be demonstrating the opposite of what it claims.
 *
 * The span is read back from the tail of the list because `span()` pushes on completion,
 * so anything the work recorded on its own lands ahead of it.
 */
async function timed<T>(
	timing: RequestTiming,
	name: string,
	work: () => Promise<T>,
): Promise<{ ms: number; value: T }> {
	const value = await timing.span(name, work);
	const last = timing.spans[timing.spans.length - 1];
	return { ms: Math.round(last?.name === name ? last.duration : 0), value };
}

/** Independent work executed one await at a time, versus all at once. */
async function measureWaterfall(timing: RequestTiming): Promise<VelocityMeasurement> {
	const parts = ['session', 'preferences', 'counts', 'feed'];

	const serialCounter = { calls: 0 };
	const serialOrigin = simulatedOrigin(serialCounter);
	const serial = await timed(timing, 'naive', async () => {
		for (const part of parts) await serialOrigin(part);
	});

	const parallelCounter = { calls: 0 };
	const parallelOrigin = simulatedOrigin(parallelCounter);
	const parallel = await timed(timing, 'velocity', () => Promise.all(parts.map((part) => parallelOrigin(part))));

	return {
		id: 'waterfall',
		naive: { label: 'one await at a time', ms: serial.ms, originCalls: serialCounter.calls },
		velocity: { label: 'Promise.all', ms: parallel.ms, originCalls: parallelCounter.calls },
		detail: [
			`${parts.length} independent lookups of ~${ORIGIN_MS}ms each: ${parts.join(', ')}.`,
			'The same round trips happen either way — only the waiting is removed, which is why the origin count is identical.',
			'Sequential awaits are only wrong when the work is independent. A real dependency still has to wait.',
		],
	};
}

/** The same value read three times: recomputed every time, versus read through a cache. */
async function measureCache(timing: RequestTiming): Promise<VelocityMeasurement> {
	const policy = definePolicy({ namespace: 'velocity-demo', ttl: 30, scope: 'shared', jitter: 0 });
	// A key unique to this run, so "cold" is genuinely cold on a warm instance.
	const id = `run-${crypto.randomUUID()}`;

	const uncachedCounter = { calls: 0 };
	const uncachedOrigin = simulatedOrigin(uncachedCounter);
	const uncached = await timed(timing, 'naive', async () => {
		for (let i = 0; i < 3; i++) await uncachedOrigin({ rows: 42 });
	});

	const cachedCounter = { calls: 0 };
	const cachedOrigin = simulatedOrigin(cachedCounter);
	const tiers: string[] = [];
	const cached = await timed(timing, 'velocity', async () => {
		for (let i = 0; i < 3; i++) {
			const read = await readThrough(policy, { id }, () => cachedOrigin({ rows: 42 }));
			tiers.push(read.tier);
		}
	});

	return {
		id: 'cache',
		naive: { label: 'recomputed each read', ms: uncached.ms, originCalls: uncachedCounter.calls },
		velocity: { label: 'read through the cache', ms: cached.ms, originCalls: cachedCounter.calls },
		detail: [
			`Three reads of one value. Tier that answered each: ${tiers.join(' → ')}.`,
			'`origin` means it was computed; `local` is this process; `shared` is Redis, and only appears when Upstash is configured for this deployment.',
			'A cache is only correct where bounded staleness is — this value has a 30s TTL and no stale window.',
		],
	};
}

/** A value past its TTL: recomputed on the reader's time, versus served stale and refreshed behind. */
async function measureStaleWhileRevalidate(timing: RequestTiming): Promise<VelocityMeasurement> {
	// TTL is seconds and the stored horizon rounds to a whole one, so the demo has to
	// actually wait out an expiry — there is no clock to fast-forward on a live request.
	// `jitter: 0` so the wait is exactly as long as the page says it is.
	const strict = definePolicy({ namespace: 'velocity-demo-strict', ttl: 1, scope: 'shared', jitter: 0 });
	const lenient = definePolicy({
		namespace: 'velocity-demo-swr',
		ttl: 1,
		staleFor: 3600,
		scope: 'shared',
		jitter: 0,
	});
	const id = `run-${crypto.randomUUID()}`;

	const strictCounter = { calls: 0 };
	const strictOrigin = simulatedOrigin(strictCounter);
	const lenientCounter = { calls: 0 };
	const lenientOrigin = simulatedOrigin(lenientCounter);

	// Warm both, untimed: what is being measured is the read AFTER expiry, not the first one.
	await readThrough(strict, { id }, () => strictOrigin({ rows: 7 }));
	await readThrough(lenient, { id }, () => lenientOrigin({ rows: 7 }));
	await sleep(EXPIRY_WAIT_MS);

	const beforeStale = lenientCounter.calls;
	const expired = await timed(timing, 'naive', () => readThrough(strict, { id }, () => strictOrigin({ rows: 7 })));
	const stale = await timed(timing, 'velocity', () => readThrough(lenient, { id }, () => lenientOrigin({ rows: 7 })));

	return {
		id: 'swr',
		naive: {
			label: 'recomputed on expiry',
			ms: expired.ms,
			originCalls: strictCounter.calls - 1,
		},
		velocity: {
			label: 'stale served, refresh behind',
			ms: stale.ms,
			// What the CALLER waited for. The refresh runs after and is deliberately not here.
			originCalls: lenientCounter.calls - beforeStale,
		},
		detail: [
			`Both values were written, then left to age past a 1s TTL (the ~${EXPIRY_WAIT_MS}ms this takes to run is that wait).`,
			`The stale read came back \`stale: ${stale.value.stale}\` from the \`${stale.value.tier}\` tier without touching the origin; its refresh was handed to \`deferAfterResponse\` and runs after this response.`,
			'The strict policy declares no stale window, so it recomputes — which is correct for it. Serving stale is a decision about correctness, not a default to inherit.',
			'Never for authorization, account security state or balances: a stale permission is a wrong permission.',
		],
	};
}

/** A hundred simultaneous misses for one value: a hundred rebuilds, versus one. */
async function measureStampede(timing: RequestTiming): Promise<VelocityMeasurement> {
	const independentCounter = { calls: 0 };
	const independentOrigin = simulatedOrigin(independentCounter);
	const independent = await timed(timing, 'naive', () =>
		Promise.all(Array.from({ length: STAMPEDE_CALLERS }, () => independentOrigin('report'))),
	);

	const coalescedCounter = { calls: 0 };
	const coalescedOrigin = simulatedOrigin(coalescedCounter);
	const key = `velocity-demo:${crypto.randomUUID()}`;
	const coalesced = await timed(timing, 'velocity', () =>
		Promise.all(Array.from({ length: STAMPEDE_CALLERS }, () => coalesce(key, () => coalescedOrigin('report')))),
	);

	return {
		id: 'stampede',
		naive: {
			label: `${STAMPEDE_CALLERS} independent rebuilds`,
			ms: independent.ms,
			originCalls: independentCounter.calls,
		},
		velocity: { label: 'one shared rebuild', ms: coalesced.ms, originCalls: coalescedCounter.calls },
		detail: [
			'Read the origin counts, not the clock. Both arms finish in about the same wall time because the calls run concurrently — what changes is what the dependency was asked to do.',
			`${STAMPEDE_CALLERS} → 1 is the whole pattern: the moment a hot key expires, every request in flight misses at once.`,
			'Coalescing is per process. Across instances, `claimRefresh` suppresses duplicate refreshes and TTL jitter keeps sibling keys from expiring together.',
		],
	};
}

/** A write plus its consequences: awaited before responding, versus deferred after. */
async function measureTail(timing: RequestTiming): Promise<VelocityMeasurement> {
	const effects = ['search index', 'activity event', 'notification fan-out'];

	const blockingCounter = { calls: 0 };
	const blockingOrigin = simulatedOrigin(blockingCounter);
	const blocking = await timed(timing, 'naive', async () => {
		await blockingOrigin('write');
		for (const effect of effects) await blockingOrigin(effect);
	});

	const deferredCounter = { calls: 0 };
	const deferredOrigin = simulatedOrigin(deferredCounter);
	const critical = await timed(timing, 'velocity', () => deferredOrigin('write'));
	// Started, never awaited by the caller — the measurement is what the USER waited for.
	// In a real request this is `deferAfterResponse`, which keeps it alive past the
	// response on a platform that would otherwise freeze the instance.
	const tail = Promise.all(effects.map((effect) => deferredOrigin(effect))).catch(() => {});

	const measurement: VelocityMeasurement = {
		id: 'tail',
		naive: { label: 'everything before the response', ms: blocking.ms, originCalls: blockingCounter.calls },
		velocity: { label: 'critical work only', ms: critical.ms, originCalls: 1 },
		detail: [
			`Critical: the write. Deferred: ${effects.join(', ')}.`,
			'The same work happens either way — the tail is off the response, not cancelled. `originCalls` counts only what the caller waited for.',
			'Deferred work must be idempotent: delivery is at-least-once and the platform can retry the request that spawned it.',
		],
	};

	// Awaited before returning so the demo leaves nothing running behind it — a real
	// request hands this to the platform instead.
	await tail;
	return measurement;
}

/** A dependency that is down: every caller pays to find out, versus the first few. */
async function measureBreaker(timing: RequestTiming): Promise<VelocityMeasurement> {
	const unguardedCounter = { calls: 0 };
	const unguardedOrigin = brokenOrigin(unguardedCounter);
	const unguarded = await timed(timing, 'naive', async () => {
		for (let i = 0; i < BREAKER_CALLERS; i++) {
			await unguardedOrigin().catch(() => {});
		}
	});

	const guardedCounter = { calls: 0 };
	const guardedOrigin = brokenOrigin(guardedCounter);
	const breaker = defineBreaker({
		name: 'velocity-demo',
		openForSeconds: 30,
		failureThreshold: BREAKER_THRESHOLD,
		failureWindowSeconds: 30,
	});
	// A subject unique to this run: on a warm instance a shared one would already be
	// open from the previous visitor, and the demo would be measuring its own history.
	const subject = `run-${crypto.randomUUID()}`;
	let refused = 0;
	// The breaker's own bookkeeping, timed separately — see the detail line. Without this
	// figure the arm reports a number the reader cannot attribute.
	let stateMs = 0;
	let stateChecks = 0;

	const guarded = await timed(timing, 'velocity', async () => {
		for (let i = 0; i < BREAKER_CALLERS; i++) {
			const askedAt = performance.now();
			const open = await breaker.isOpen(subject);
			stateMs += performance.now() - askedAt;
			stateChecks++;
			if (open) {
				refused++;
				continue;
			}
			await guardedOrigin().catch(async () => {
				const failedAt = performance.now();
				await breaker.recordFailure(subject);
				stateMs += performance.now() - failedAt;
				stateChecks++;
			});
		}
	});
	// Never `resetBreakers()` here — that would clear the AI provider cooldowns of the
	// running application. A demo cleans up after itself by subject.
	await breaker.reset(subject);

	return {
		id: 'breaker',
		naive: { label: 'every caller waits for the failure', ms: unguarded.ms, originCalls: unguardedCounter.calls },
		velocity: { label: 'stop asking after the third', ms: guarded.ms, originCalls: guardedCounter.calls },
		detail: [
			`Read the origin counts, not the clock: ${BREAKER_CALLERS} → ${guardedCounter.calls}. ${refused} callers were refused without touching the dependency at all.`,
			`The velocity arm's clock includes the breaker's own bookkeeping: ${stateChecks} state reads and writes costing ${Math.round(stateMs)}ms in total, or about ${Math.round(stateMs / Math.max(1, stateChecks))}ms each. That is a Redis round trip when Upstash is configured — single-digit milliseconds from a function in the same region, more from a dev container, and more again while the other panels on this page are hammering the same connection.`,
			`So the trade is arithmetic: a breaker pays off when a failure costs more than a state check. At ~${FAILING_MS}ms against ~${Math.round(stateMs / Math.max(1, stateChecks))}ms it ${guarded.ms < unguarded.ms ? 'came out ahead on this run' : 'did NOT pay off on this run'} — the same code lands either way depending on where it runs, which is why the count above is the figure that transfers and the clock is not.`,
			'The saving is never the failures. It is the waiting: an unhealthy dependency is expensive because discovering it is unhealthy costs as much as success, on every request, until something stops asking.',
			'There is no half-open state. The first caller after the window is the probe, and one more failure reopens it.',
		],
	};
}

/** A slow capability and a fast one: sharing a pool, versus separate compartments. */
async function measureBulkhead(timing: RequestTiming): Promise<VelocityMeasurement> {
	const sharedCounter = { calls: 0 };
	const sharedSlow = simulatedOrigin(sharedCounter, SLOW_MS);
	const sharedFast = simulatedOrigin(sharedCounter, 1);
	const shared = defineBulkhead({ name: 'velocity-demo-shared', maxConcurrent: POOL_SIZE, maxQueued: 64 });

	const sharedSlowWork = Array.from({ length: SLOW_CALLERS }, () => shared.run(() => sharedSlow('report')));
	// What is measured is the FAST capability's latency, not the slow one's — the harm a
	// bulkhead prevents is always to something other than the dependency that caused it.
	const crowded = await timed(timing, 'naive', () => shared.run(() => sharedFast('profile')));
	await Promise.all(sharedSlowWork);

	const isolatedCounter = { calls: 0 };
	const isolatedSlow = simulatedOrigin(isolatedCounter, SLOW_MS);
	const isolatedFast = simulatedOrigin(isolatedCounter, 1);
	const slowPool = defineBulkhead({ name: 'velocity-demo-slow', maxConcurrent: POOL_SIZE / 2, maxQueued: 64 });
	const fastPool = defineBulkhead({ name: 'velocity-demo-fast', maxConcurrent: POOL_SIZE / 2, maxQueued: 64 });

	const isolatedSlowWork = Array.from({ length: SLOW_CALLERS }, () => slowPool.run(() => isolatedSlow('report')));
	const isolated = await timed(timing, 'velocity', () => fastPool.run(() => isolatedFast('profile')));
	await Promise.all(isolatedSlowWork);

	return {
		id: 'bulkhead',
		naive: { label: 'one shared pool', ms: crowded.ms, originCalls: sharedCounter.calls },
		velocity: { label: 'a compartment each', ms: isolated.ms, originCalls: isolatedCounter.calls },
		detail: [
			`${SLOW_CALLERS} calls to a ~${SLOW_MS}ms dependency are already in flight when one fast call arrives at a ${POOL_SIZE}-slot pool.`,
			'The origin counts are identical on purpose. Nothing was avoided and nothing was made faster — the fast capability simply stopped queueing behind a slow one.',
			"The slow capability got SLOWER: half the slots means twice the rounds. That is the trade, and a bulkhead is worth it exactly when one capability's throughput is worth less than another's latency.",
			"This bounds one instance. Ten serverless instances hold ten pools, and the fleet-wide bound is the platform's concurrency setting — which is where it belongs.",
		],
	};
}

/** A chain of slow calls: each with its own full timeout, versus one shared budget. */
async function measureDeadline(timing: RequestTiming): Promise<VelocityMeasurement> {
	const isolatedCounter = { calls: 0 };
	const isolatedStep = simulatedOrigin(isolatedCounter, HANGING_MS);
	const isolated = await timed(timing, 'naive', async () => {
		for (let step = 0; step < CHAIN_STEPS; step++) {
			// Each step's own timeout, chosen in isolation and reasonable in isolation.
			await Promise.race([isolatedStep('step'), sleep(STEP_TIMEOUT_MS)]);
		}
	});

	const budgetedCounter = { calls: 0 };
	const budgetedStep = simulatedOrigin(budgetedCounter, HANGING_MS);
	let skipped = 0;
	const budgeted = await timed(timing, 'velocity', async () => {
		const deadline = startDeadline(RUN_BUDGET_MS);
		for (let step = 0; step < CHAIN_STEPS; step++) {
			const slice = deadline.child(STEP_TIMEOUT_MS);
			if (slice.remainingMs() < MIN_STEP_MS) {
				skipped++;
				continue;
			}
			await slice.run(() => budgetedStep('step')).catch(() => {});
		}
	});

	return {
		id: 'deadline',
		naive: {
			label: `${CHAIN_STEPS} × ${STEP_TIMEOUT_MS}ms, each its own`,
			ms: isolated.ms,
			originCalls: isolatedCounter.calls,
		},
		velocity: { label: `one ${RUN_BUDGET_MS}ms budget, divided`, ms: budgeted.ms, originCalls: budgetedCounter.calls },
		detail: [
			`${CHAIN_STEPS} sequential calls to a dependency that takes ~${HANGING_MS}ms. Every timeout here fires; the question is only how many of them the caller pays for.`,
			`The naive arm's bound is ${CHAIN_STEPS} × ${STEP_TIMEOUT_MS}ms — a number nobody chose and nobody can find, because no single timeout in it is wrong.`,
			`The velocity arm started ${budgetedCounter.calls} of ${CHAIN_STEPS} steps and skipped ${skipped}: below ${MIN_STEP_MS}ms there is no window in which the result could have come back and been used.`,
			'The deadline bounds the WAIT, not the work. An operation that ignores its AbortSignal still runs to completion behind the rejection.',
		],
	};
}

/** Every measurement returns the same two-armed shape; the type is the contract. */
const MEASUREMENTS: Record<VelocityMeasurementId, (timing: RequestTiming) => Promise<VelocityMeasurement>> = {
	waterfall: measureWaterfall,
	cache: measureCache,
	swr: measureStaleWhileRevalidate,
	stampede: measureStampede,
	tail: measureTail,
	breaker: measureBreaker,
	bulkhead: measureBulkhead,
	deadline: measureDeadline,
};

export async function runVelocityMeasurement(
	id: VelocityMeasurementId,
	timing: RequestTiming,
): Promise<VelocityMeasurement> {
	const measurement = await MEASUREMENTS[id](timing);
	// Handed back so the page can show that its two numbers ARE the header's two spans.
	return { ...measurement, spans: timing.spans.map((span) => ({ name: span.name, ms: Math.round(span.duration) })) };
}
