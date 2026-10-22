/**
 * Verify a running order-rules service THROUGH THE REAL ADAPTER, and measure it.
 *
 *   bun run external-service:verify                    # target `local`
 *   bun run external-service:verify -- --target remote --samples 50
 *
 * Reads EXTERNAL_SERVICE_{LOCAL,REMOTE}_{URL,TOKEN} from the environment (Bun loads .env)
 * and resolves them with the same rules the app uses. Works for the local container and
 * for the hosted service alike — it is the hosted-verification step of the Render
 * handoff. Exits 1 when any check fails.
 *
 * What it measures, and how (no figure here is estimated):
 * - first call  — liveness with a 120 s budget. On a host that idles (Render Free), run it
 *                 after >15 min of no traffic to observe a cold start; `uptimeMs` from the
 *                 status call then says whether this run woke the process.
 * - warm series — N sequential `evaluate` calls: round trip, the service's own
 *                 `Server-Timing: app`, adapter overhead (total − round trip). p50/p95/max.
 * - failure detection — time until a classified failure: connection refused (closed
 *                 local port) and a spent deadline; plus how often a 1 ms budget loses
 *                 the race to the service (why the lab's deadline drill does not use it).
 * - negative paths — wrong credential, invalid input past the adapter, oversized body,
 *                 adapter-side refusal.
 */
import { execSync } from 'node:child_process';
import { plugin } from 'bun';
import type { ServiceTarget } from '../../src/lib/server/showcases/external-service/targets';
import type { ServiceTargetId } from '../../src/lib/showcases/external-service/types';

// The adapter reuses `retryWithin` from the resilience barrel, which reaches SvelteKit's
// virtual env modules. Outside Vite they do not exist; resolve them to the process
// environment — the same shim `src/lib/server/test/vitest.setup.ts` installs for tests.
plugin({
	name: 'sveltekit-env-shim',
	setup(build) {
		build.module('$env/dynamic/private', () => ({ exports: { env: process.env }, loader: 'object' }));
		build.module('$app/environment', () => ({
			exports: { dev: false, building: false, browser: false, version: 'verify' },
			loader: 'object',
		}));
	},
});

const { startDeadline } = await import('../../src/lib/server/http/deadline');
const { callService, SERVICE_OPERATIONS } = await import('../../src/lib/server/showcases/external-service/client');
const { EVALUATION_SCENARIOS, UNVALIDATED_DRILL_REQUEST, WRONG_CREDENTIAL } = await import(
	'../../src/lib/server/showcases/external-service/scenarios'
);
const { resolveServiceTarget } = await import('../../src/lib/server/showcases/external-service/targets');

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
	const index = args.indexOf(`--${name}`);
	return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const targetId = option('target', 'local') as ServiceTargetId;
const samples = Math.max(1, Number(option('samples', '30')));
const prefix = `EXTERNAL_SERVICE_${targetId.toUpperCase()}`;

const resolved = resolveServiceTarget(targetId, {
	url: process.env[`${prefix}_URL`],
	token: process.env[`${prefix}_TOKEN`],
});
if (resolved.setup !== 'configured') {
	console.error(
		`target ${targetId}: ${resolved.setup}${resolved.setup === 'misconfigured' ? ` (${resolved.problem})` : ''} — set ${prefix}_URL and ${prefix}_TOKEN`,
	);
	process.exit(1);
}
const target: ServiceTarget = resolved.target;

// Failure lines are the point of several checks below; keep the report readable.
console.warn = () => {};

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
	if (!ok) failures++;
	console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const percentile = (values: number[], p: number) => {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};
const describe = (values: number[]) =>
	values.length === 0
		? 'n/a'
		: `p50 ${percentile(values, 50).toFixed(2)} · p95 ${percentile(values, 95).toFixed(2)} · max ${Math.max(...values).toFixed(2)} ms`;

const commit = (() => {
	try {
		return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
	} catch {
		return 'unknown';
	}
})();

console.log(`external-service verify — target ${targetId} (${new URL(target.origin).host})`);
console.log(`  conditions: ${new Date().toISOString()} · commit ${commit} · bun ${Bun.version} · ${process.platform}`);

// ── First call: cold start, if the host was idle ────────────────────────────────────
console.log('\nfirst call');
const first = await callService(target, SERVICE_OPERATIONS.live, undefined, { deadline: startDeadline(120_000) });
check('liveness answers', first.ok, `${first.timing.totalMs} ms total, ${first.timing.attempts} attempt(s)`);
const status = await callService(target, SERVICE_OPERATIONS.status, undefined, { deadline: startDeadline(30_000) });
check(
	'status authenticates and matches the contract',
	status.ok,
	status.ok ? `release ${status.data.release}` : status.kind,
);
if (status.ok && first.ok) {
	const woke = status.data.uptimeMs < first.timing.totalMs + status.timing.totalMs + 1_000;
	console.log(
		`  uptime ${status.data.uptimeMs} ms → ${woke ? 'this run started the process (cold start observed)' : 'process was already running (warm)'}`,
	);
}

// ── Warm series ─────────────────────────────────────────────────────────────────────
console.log(`\nwarm series — ${samples} × evaluate(fulfilled), sequential`);
const roundTrip: number[] = [];
const service: number[] = [];
const adapter: number[] = [];
const total: number[] = [];
let warmFailures = 0;
for (let i = 0; i < samples; i++) {
	const call = await callService(target, SERVICE_OPERATIONS.evaluate, EVALUATION_SCENARIOS.fulfilled, {
		deadline: startDeadline(8_000),
	});
	if (!call.ok || call.data.outcome !== 'accepted') {
		warmFailures++;
		continue;
	}
	total.push(call.timing.totalMs);
	if (call.timing.roundTripMs !== null) roundTrip.push(call.timing.roundTripMs);
	if (call.timing.serviceMs !== null) service.push(call.timing.serviceMs);
	if (call.timing.adapterMs !== null) adapter.push(call.timing.adapterMs);
}
check(`${samples - warmFailures}/${samples} accepted`, warmFailures === 0);
console.log(`  HTTP round trip    ${describe(roundTrip)}`);
console.log(`  service (app)      ${describe(service)}`);
console.log(`  adapter overhead   ${describe(adapter)}`);
console.log(`  adapter total      ${describe(total)}`);

// ── Negative paths against the real service ─────────────────────────────────────────
console.log('\nnegative paths');
const evaluate = SERVICE_OPERATIONS.evaluate;
const wrong = await callService(target, evaluate, EVALUATION_SCENARIOS.fulfilled, {
	deadline: startDeadline(8_000),
	token: WRONG_CREDENTIAL,
});
check('wrong credential → unauthorized (401 from the service)', !wrong.ok && wrong.httpStatus === 401);
const unvalidated = await callService(target, evaluate, UNVALIDATED_DRILL_REQUEST, {
	deadline: startDeadline(8_000),
	validateRequest: false,
});
check(
	'invalid input past the adapter → invalid_request (400 from the service)',
	!unvalidated.ok && unvalidated.httpStatus === 400,
	unvalidated.ok ? '' : unvalidated.message,
);
const oversized = await callService(
	target,
	evaluate,
	// ~10 KiB: past the service's 8 KiB body limit.
	{ totalCents: 100, events: Array.from({ length: 700 }, () => ({ type: 'ship' as const })) },
	{ deadline: startDeadline(8_000), validateRequest: false },
);
check('oversized body → too_large (413 from the service)', !oversized.ok && oversized.httpStatus === 413);
const refused = await callService(target, evaluate, UNVALIDATED_DRILL_REQUEST, { deadline: startDeadline(8_000) });
check('adapter refuses invalid input without sending', !refused.ok && refused.httpStatus === null);
const refusal = await callService(target, evaluate, EVALUATION_SCENARIOS.ship_unpaid, {
	deadline: startDeadline(8_000),
});
check(
	'a rule refusal is a 200 answer',
	refusal.ok && refusal.data.outcome === 'refused' && refusal.data.refusal.reason === 'payment_incomplete',
);

// ── Failure detection ───────────────────────────────────────────────────────────────
console.log('\nfailure detection');
const slowSamples = 20;
let raced = 0;
for (let i = 0; i < slowSamples; i++) {
	const call = await callService(target, evaluate, EVALUATION_SCENARIOS.fulfilled, { deadline: startDeadline(1) });
	if (call.ok) raced++;
}
console.log(
	`  1 ms budget: the service answered in time ${raced}/${slowSamples} times (why the lab's drill uses a spent budget)`,
);
const spent = await callService(target, evaluate, EVALUATION_SCENARIOS.fulfilled, { deadline: startDeadline(0) });
check(
	'spent budget → timed_out, nothing sent',
	!spent.ok && spent.kind === 'timed_out' && spent.timing.attempts === 0,
	`classified after ${spent.timing.totalMs} ms`,
);
const closed: ServiceTarget = { ...target, origin: 'http://127.0.0.1:1' };
const refusedConnect = await callService(closed, SERVICE_OPERATIONS.live, undefined, {
	deadline: startDeadline(8_000),
});
check(
	'connection refused → unreachable',
	!refusedConnect.ok && refusedConnect.kind === 'unreachable',
	`classified after ${refusedConnect.timing.totalMs} ms, ${refusedConnect.timing.attempts} attempts`,
);

console.log(failures === 0 ? '\nverify: all checks passed' : `\nverify: ${failures} check(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
