/**
 * Verify a running runtime-lab service THROUGH THE REAL SERVICE CLIENT, and measure it.
 *
 *   bun run external-service:verify                    # target `local`
 *   bun run external-service:verify -- --target remote --samples 50 --concurrency 4 \
 *     --idle-gap-ms 6000 --idle-samples 5
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
 * - warm series — N `evaluate` calls (`--concurrency` lanes, default 1; at most 4 against
 *                 `remote` — a free host is not a load-test target): round trip, the
 *                 service's own `Server-Timing: app`, client overhead (total − round trip).
 *                 p50/p95/max; p99 only from 100 samples, and it stays indicative.
 * - idle gaps   — `--idle-samples` calls, each after `--idle-gap-ms` of quiet (default off).
 *                 Past the service's 5 s idle close, a host proxy that reuses its upstream
 *                 connection can race the close; past the client's keep-alive, the call opens
 *                 a new (TLS) connection. This runs on Bun's fetch, whose keep-alive is not
 *                 Node's (undici: 4 s) that the deployed app uses — so the round trip after a
 *                 gap approximates, not reproduces, the app's. Each call's outcome is printed.
 * - failure detection — time until a classified failure: connection refused (closed
 *                 local port) and a spent deadline; plus how often a 1 ms budget loses
 *                 the race to the service (why the lab's deadline drill does not use it).
 * - negative paths — wrong credential, invalid input past the client, oversized body,
 *                 client-side rejection; and every preset's stated answer.
 */
import { execSync } from 'node:child_process';
import { plugin } from 'bun';
import type { ServiceTarget } from '../../src/lib/server/showcases/external-service/targets';
import type { ServiceTargetId } from '../../src/lib/showcases/external-service/types';

// The service client reuses `retryWithin` from the resilience barrel, which reaches SvelteKit's
// virtual env modules. Outside Vite they do not exist; resolve them to the process
// environment — the same shim `src/lib/server/test/vitest.setup.ts` installs for tests.
const { variables } = await import('../../src/env.ts');

plugin({
	name: 'sveltekit-env-shim',
	setup(build) {
		build.module('$app/env/private', () => ({
			exports: Object.fromEntries(Object.keys(variables).map((name) => [name, process.env[name]])),
			loader: 'object',
		}));
		build.module('$app/env', () => ({
			exports: { dev: false, building: false, browser: false, version: 'verify' },
			loader: 'object',
		}));
	},
});

const { startDeadline } = await import('../../src/lib/server/http/deadline');
const { callService, SERVICE_OPERATIONS } = await import('../../src/lib/server/showcases/external-service/client');
const { EVALUATION_PRESETS, UNVALIDATED_DRILL_REQUEST, WRONG_CREDENTIAL } = await import(
	'../../src/lib/server/showcases/external-service/presets'
);
const { resolveServiceTarget } = await import('../../src/lib/server/showcases/external-service/targets');
const { startedDuringCheck } = await import('../../src/lib/showcases/external-service/cold-start');
const { contractSkew } = await import('../../src/lib/server/showcases/external-service/contract-skew');
const { CONTRACT_RELEASE } = await import('../../src/lib/showcases/external-service/contract.generated');

// Strict: a typo must stop the run, not turn it into a pass with zero calls.
const OPTIONS = ['target', 'samples', 'concurrency', 'idle-gap-ms', 'idle-samples'] as const;
type OptionName = (typeof OPTIONS)[number];
const given = new Map<OptionName, string>();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
	const [flag, inline] = argv[i].split(/=(.*)/s, 2);
	const name = flag.replace(/^--/, '') as OptionName;
	const value = inline ?? argv[++i];
	if (!flag.startsWith('--') || !OPTIONS.includes(name) || value === undefined || given.has(name)) {
		console.error(`usage: verify.ts [--${OPTIONS.join(' <v>] [--')} <v>] — could not read "${flag}"`);
		process.exit(2);
	}
	given.set(name, value);
}
const count = (name: OptionName, fallback: number, min: number) => {
	const raw = given.get(name) ?? String(fallback);
	if (!/^\d+$/.test(raw) || Number(raw) < min) {
		console.error(`--${name} must be an integer ≥ ${min}, got "${raw}"`);
		process.exit(2);
	}
	return Number(raw);
};
const targetId = (given.get('target') ?? 'local') as ServiceTargetId;
if (targetId !== 'local' && targetId !== 'remote') {
	console.error(`--target must be local or remote, got "${targetId}"`);
	process.exit(2);
}
const samples = count('samples', 30, 1);
/** A hosted free tier is measured, never load-tested. */
const REMOTE_MAX_CONCURRENCY = 4;
const concurrency = count('concurrency', 1, 1);
if (targetId === 'remote' && concurrency > REMOTE_MAX_CONCURRENCY) {
	console.error(`--concurrency is capped at ${REMOTE_MAX_CONCURRENCY} against remote`);
	process.exit(2);
}
const idleGapMs = count('idle-gap-ms', 0, 0);
const idleSamples = count('idle-samples', idleGapMs > 0 ? 3 : 0, 0);
if (idleSamples > 0 && idleGapMs === 0) {
	console.error('--idle-samples needs --idle-gap-ms > 0');
	process.exit(2);
}
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
/** p99 needs ~100 samples before it is more than the second-largest value; even then it is indicative. */
const P99_MIN_SAMPLES = 100;
const describe = (values: number[]) =>
	values.length === 0
		? 'n/a'
		: `p50 ${percentile(values, 50).toFixed(2)} · p95 ${percentile(values, 95).toFixed(2)}${
				values.length >= P99_MIN_SAMPLES ? ` · p99 ${percentile(values, 99).toFixed(2)} (indicative)` : ''
			} · max ${Math.max(...values).toFixed(2)} ms · n ${values.length}`;

const commit = (() => {
	try {
		return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
	} catch {
		return 'unknown';
	}
})();

console.log(`external-service verify — target ${targetId} (${new URL(target.origin).host})`);
console.log(
	`  conditions: ${new Date().toISOString()} · commit ${commit} · bun ${Bun.version} · ${process.platform} · concurrency ${concurrency}`,
);

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
	const woke = startedDuringCheck(status.data.uptimeMs, first.timing.totalMs + status.timing.totalMs);
	console.log(
		`  uptime ${status.data.uptimeMs} ms → ${woke ? 'this run started the process (cold start observed)' : 'process was already running (warm)'}`,
	);
}
if (status.ok) {
	console.log(
		`  contract: service ${status.data.release}, this app ${CONTRACT_RELEASE} → skew ${contractSkew(status.data.release, CONTRACT_RELEASE)}`,
	);
}

// ── Warm series ─────────────────────────────────────────────────────────────────────
console.log(`\nwarm series — ${samples} × evaluate(fulfilled), ${concurrency} lane(s)`);
const roundTrip: number[] = [];
const service: number[] = [];
const client: number[] = [];
const total: number[] = [];
let warmFailures = 0;
let issued = 0;
const seriesStarted = performance.now();
const lane = async () => {
	while (issued < samples) {
		issued++;
		const call = await callService(target, SERVICE_OPERATIONS.evaluate, EVALUATION_PRESETS.fulfilled.request, {
			deadline: startDeadline(8_000),
		});
		if (!call.ok || call.data.outcome !== 'accepted') {
			warmFailures++;
			continue;
		}
		total.push(call.timing.totalMs);
		if (call.timing.roundTripMs !== null) roundTrip.push(call.timing.roundTripMs);
		if (call.timing.serviceMs !== null) service.push(call.timing.serviceMs);
		if (call.timing.clientMs !== null) client.push(call.timing.clientMs);
	}
};
await Promise.all(Array.from({ length: concurrency }, lane));
const seriesSeconds = (performance.now() - seriesStarted) / 1000;
check(`${samples - warmFailures}/${samples} accepted`, warmFailures === 0);
console.log(`  HTTP round trip    ${describe(roundTrip)}`);
console.log(`  service (app)      ${describe(service)}`);
console.log(`  client overhead    ${describe(client)}`);
console.log(`  client total       ${describe(total)}`);
console.log(`  throughput         ${(samples / seriesSeconds).toFixed(1)} calls/s over ${seriesSeconds.toFixed(2)} s`);

// ── Idle gaps: what a call costs after quiet, and whether a quiet connection survives ──
if (idleSamples > 0) {
	console.log(`\nidle gaps — ${idleSamples} × evaluate, each after ${idleGapMs} ms of quiet`);
	let gapFailures = 0;
	for (let i = 0; i < idleSamples; i++) {
		await Bun.sleep(idleGapMs);
		const call = await callService(target, SERVICE_OPERATIONS.evaluate, EVALUATION_PRESETS.fulfilled.request, {
			deadline: startDeadline(8_000),
		});
		if (!call.ok) gapFailures++;
		console.log(
			`  after ${idleGapMs} ms: ${call.ok ? 'ok' : `${call.kind} (${call.httpStatus ?? 'no response'})`} · round trip ${call.timing.roundTripMs ?? '—'} ms · ${call.timing.attempts} attempt(s)`,
		);
	}
	check(`${idleSamples - gapFailures}/${idleSamples} calls after a quiet gap succeeded`, gapFailures === 0);
}

// ── Negative paths against the real service ─────────────────────────────────────────
console.log('\nnegative paths');
const evaluate = SERVICE_OPERATIONS.evaluate;
// An operation without a request schema sends whatever it is given — the lab's drill.
const unchecked = { ...evaluate, requestSchema: null };
const budget = () => ({ deadline: startDeadline(8_000) });

const wrong = await callService(
	{ ...target, token: WRONG_CREDENTIAL },
	evaluate,
	EVALUATION_PRESETS.fulfilled.request,
	budget(),
);
check('wrong credential → unauthorized (401 from the service)', !wrong.ok && wrong.httpStatus === 401);
const unvalidated = await callService(target, unchecked, UNVALIDATED_DRILL_REQUEST, budget());
check(
	'invalid input past the client → invalid_request (400 from the service)',
	!unvalidated.ok && unvalidated.httpStatus === 400,
	unvalidated.ok ? '' : unvalidated.message,
);
// ~10 KiB: past the service's 8 KiB body limit.
const oversizedBody = { totalCents: 100, events: Array.from({ length: 700 }, () => ({ type: 'ship' as const })) };
const oversized = await callService(target, unchecked, oversizedBody, budget());
check('oversized body → too_large (413 from the service)', !oversized.ok && oversized.httpStatus === 413);
const rejected = await callService(target, evaluate, UNVALIDATED_DRILL_REQUEST, budget());
check('client rejects invalid input without sending', !rejected.ok && rejected.httpStatus === null);

// ── Every preset's stated answer, against the real rules ────────────────────────────
console.log('\npresets');
for (const [id, preset] of Object.entries(EVALUATION_PRESETS)) {
	const call = await callService(target, evaluate, preset.request, budget());
	const answer = call.ok ? call.data : null;
	const expected = preset.expect;
	const matches =
		answer !== null &&
		(expected.outcome === 'accepted'
			? answer.outcome === 'accepted' && answer.finalState === expected.finalState
			: answer.outcome === 'refused' &&
				answer.refusal.index === expected.index &&
				answer.refusal.reason === expected.reason);
	check(`${id} → ${JSON.stringify(expected)}`, matches, call.ok ? '' : call.kind);
}

// ── Failure detection ───────────────────────────────────────────────────────────────
console.log('\nfailure detection');
const slowSamples = 20;
let raced = 0;
for (let i = 0; i < slowSamples; i++) {
	const call = await callService(target, evaluate, EVALUATION_PRESETS.fulfilled.request, {
		deadline: startDeadline(1),
	});
	if (call.ok) raced++;
}
console.log(
	`  1 ms budget: the service answered in time ${raced}/${slowSamples} times (why the lab's drill uses a spent budget)`,
);
const spent = await callService(target, evaluate, EVALUATION_PRESETS.fulfilled.request, { deadline: startDeadline(0) });
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
