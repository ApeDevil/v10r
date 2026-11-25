/**
 * A2A interop run — `bun run a2a:interop`.
 *
 * Two implementations of A2A 1.0 that share no code, in both directions, on loopback:
 *
 *   (a) v10r's JS client (`delegateArchitectureReview`, `@a2a-js/sdk`) → the Python peer
 *       (`scripts/a2a/peer/performance_agent.py`, `a2a-sdk`), started here through `uv`;
 *   (a′) assistant-driven delegation: the external-operations adapter's prepare → verify →
 *       execute against the same peer — success, rejection, invalid result, timeout and abort
 *       (each with a confirmed `CancelTask`), budget/depth and operator-authorization refusals;
 *   (b) the Python client (`scripts/a2a/peer/client_probe.py`) → v10r's server, served by
 *       `Bun.serve` from the same `respondToA2aPost` the `/api/a2a` route calls — not the dev
 *       server, so no database, Redis or SvelteKit is involved.
 *
 * Prints a pass/fail table, writes `scripts/a2a/interop-report.json` (deterministic fields
 * only: no ports, ids or timings), and exits non-zero on any failure. Needs `uv` and network
 * access to PyPI on the first run (the SDK is cached afterwards).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { type AgentCard, Role, TaskState } from '@a2a-js/sdk';
import { ClientFactory, DefaultAgentCardResolver, JsonRpcTransportFactory } from '@a2a-js/sdk/client';
import {
	A2A_PROTOCOL_VERSION,
	type A2aDelegationAdapterOptions,
	type A2aDelegationPeer,
	buildArchitectureReviewCard,
	createA2aDelegationAdapter,
	createDelegationBudget,
	dataPart,
	delegateArchitectureReview,
	type PeerPolicy,
	respondToA2aPost,
} from '#lib/server/a2a/index.ts';
import type { ExternalExecutionResult, ExternalOperationRequest } from '#lib/server/external-operations/index.ts';
import type { ArchitectureModel } from '#patterns/architecture-engineering/index.ts';
import { sampleReviewModel } from '../../src/lib/server/a2a/review-sample.ts';

const PYTHON_SDK = 'a2a-sdk[http-server]==1.3.1';
const PEER_SCRIPT = join(import.meta.dir, 'peer', 'performance_agent.py');
const PROBE_SCRIPT = join(import.meta.dir, 'peer', 'client_probe.py');
const REPORT_PATH = join(import.meta.dir, 'interop-report.json');
const STARTUP_MS = 120_000;
/** Loopback traffic must not go through an outbound proxy the environment may configure. */
const LOOPBACK_ENV = { ...process.env, NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' };

interface Check {
	leg: 'js-client→python-server' | 'js-delegation→python-server' | 'python-client→js-server';
	name: string;
	ok: boolean;
	detail: string;
}

const checks: Check[] = [];
const record = (leg: Check['leg'], name: string, ok: boolean, detail = '') => checks.push({ leg, name, ok, detail });
const JS_LEG = 'js-client→python-server' as const;
const PY_LEG = 'python-client→js-server' as const;
const DELEGATION_LEG = 'js-delegation→python-server' as const;

function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const { port } = server.address() as { port: number };
			server.close(() => resolve(port));
		});
	});
}

async function waitForCard(origin: string, peer: ReturnType<typeof Bun.spawn>): Promise<boolean> {
	const until = Date.now() + STARTUP_MS;
	while (Date.now() < until) {
		if (peer.exitCode !== null) return false;
		try {
			const response = await fetch(`${origin}/.well-known/agent-card.json`);
			if (response.ok) return true;
		} catch {
			// not listening yet
		}
		await Bun.sleep(250);
	}
	return false;
}

function uvPython(script: string, args: string[]): string[] {
	return [
		'uv',
		'run',
		'--quiet',
		'--no-project',
		'--with',
		PYTHON_SDK,
		'--with',
		'uvicorn',
		'python',
		'-I',
		script,
		...args,
	];
}

/** (a) v10r's JS client against the independent Python peer. */
async function jsClientLeg(origin: string, model: ArchitectureModel): Promise<void> {
	const port = Number(new URL(origin).port);
	const policy: PeerPolicy = { peers: [{ origin, privateDestinations: [{ cidr: '127.0.0.1/32', port }] }] };
	const loopback = { policy, allowLoopbackHttp: true } as const;

	const card: AgentCard = await new DefaultAgentCardResolver().resolve(origin);
	record(
		JS_LEG,
		'card: resolves, names the performance-review skill at protocol 1.0',
		card.skills.some((skill) => skill.id === 'performance-review') &&
			card.supportedInterfaces.some((entry) => entry.protocolVersion === A2A_PROTOCOL_VERSION),
		`${card.name} ${card.version}`,
	);

	const claim = await delegateArchitectureReview(origin, model, { ...loopback, skill: 'performance-review' });
	record(
		JS_LEG,
		'delegate: completed task → claim with validated findings',
		claim.status === 'claimed' && claim.findings.length > 0 && claim.dropped === 0 && claim.verified === false,
		claim.status === 'claimed'
			? `findings=${claim.findings.length} dropped=${claim.dropped} codes=${[...new Set(claim.findings.map((f) => f.code))].sort().join(',')}`
			: `${claim.status}: ${'message' in claim ? claim.message : claim.reason}`,
	);

	const adversarial = await delegateArchitectureReview(origin, model, {
		...loopback,
		skill: 'malformed-findings-fixture',
	});
	record(
		JS_LEG,
		'adversarial: malformed findings are dropped and counted',
		adversarial.status === 'claimed' && adversarial.findings.length === 1 && adversarial.dropped === 4,
		adversarial.status === 'claimed'
			? `kept=${adversarial.findings.length} dropped=${adversarial.dropped}`
			: adversarial.status,
	);

	const unknownSkill = await delegateArchitectureReview(origin, model, { ...loopback, skill: 'no-such-skill' });
	record(
		JS_LEG,
		'delegate: an unknown skill is declined (rejected), not claimed',
		unknownSkill.status === 'declined' && unknownSkill.taskState === 'TASK_STATE_REJECTED',
		unknownSkill.status === 'declined' ? unknownSkill.taskState : unknownSkill.status,
	);

	const invalid = await delegateArchitectureReview(origin, { format: 2 } as unknown as ArchitectureModel, {
		...loopback,
		skill: 'performance-review',
	});
	record(
		JS_LEG,
		'delegate: an invalid model is declined by the peer',
		invalid.status === 'declined' && invalid.taskState === 'TASK_STATE_REJECTED',
		invalid.status === 'declined' ? invalid.taskState : invalid.status,
	);

	const ssrf = await delegateArchitectureReview(origin, model, {
		policy: { peers: [{ origin }] },
		allowLoopbackHttp: true,
	});
	record(
		JS_LEG,
		'guard: the same loopback peer without a listed private destination is refused',
		ssrf.status === 'refused' && ssrf.code === 'private_address',
		ssrf.status === 'refused' ? ssrf.code : ssrf.status,
	);

	// Protocol paths the delegation API does not expose, through the plain SDK client.
	const client = await new ClientFactory({ transports: [new JsonRpcTransportFactory()] }).createFromAgentCard(card);
	for (const [name, call] of [
		['getTask', () => client.getTask({ tenant: '', id: 'no-such-task', historyLength: undefined })],
		['cancelTask', () => client.cancelTask({ tenant: '', id: 'no-such-task', metadata: undefined })],
	] as const) {
		try {
			await call();
			record(JS_LEG, `${name}: an unknown task is an error`, false, 'no error');
		} catch (error) {
			record(JS_LEG, `${name}: an unknown task is an error`, /not found/i.test(String(error)), (error as Error).name);
		}
	}

	const kinds: string[] = [];
	let finalState: TaskState | undefined;
	for await (const event of client.sendMessageStream({
		tenant: '',
		message: {
			messageId: crypto.randomUUID(),
			contextId: '',
			taskId: '',
			role: Role.ROLE_USER,
			parts: [dataPart(model)],
			metadata: { skill: 'performance-review' },
			extensions: [],
			referenceTaskIds: [],
		},
		configuration: undefined,
		metadata: undefined,
	})) {
		const payload = event.payload;
		if (!payload) continue;
		kinds.push(payload.$case);
		if (payload.$case === 'task') finalState = payload.value.status?.state;
		if (payload.$case === 'statusUpdate') finalState = payload.value.status?.state;
	}
	record(
		JS_LEG,
		'stream: SSE events end in completed with an artifact',
		finalState === TaskState.TASK_STATE_COMPLETED && kinds.includes('artifactUpdate'),
		kinds.join(' -> '),
	);
}

/**
 * (a′) Assistant-driven delegation against the Python peer: the external-operations adapter
 * (prepare → verify → execute, as the domain runs it after a human approval), so every check
 * here is a receipt the approval card would show. Fixture skills are served by
 * `--allow-fixtures` and allowed by this run's operator entry only.
 */
async function delegationLeg(origin: string, model: ArchitectureModel): Promise<void> {
	const port = Number(new URL(origin).port);
	const peer: A2aDelegationPeer = {
		id: 'performance',
		label: 'Independent performance peer (Python)',
		origin,
		skills: ['performance-review', 'invalid-report-fixture', 'rejecting-review-fixture', 'slow-review-fixture'],
		auth: { kind: 'none' },
		privateDestinations: [{ cidr: '127.0.0.1/32', port }],
	};
	type Run = ExternalExecutionResult | { prepared: string };
	const approvedRun = async (
		operation: string,
		extra: Partial<A2aDelegationAdapterOptions> = {},
		signal: AbortSignal = new AbortController().signal,
	): Promise<Run> => {
		const adapter = createA2aDelegationAdapter({
			peers: [peer],
			resolveSecret: () => undefined,
			wrapResult: (source, text) => `<untrusted-content source="${source}">\n${text}\n</untrusted-content>`,
			allowLoopbackHttp: true,
			...extra,
		});
		const request: ExternalOperationRequest = {
			protocol: 'a2a',
			peerId: peer.id,
			operation,
			arguments: { model },
			userId: 'interop',
			conversationId: null,
		};
		const prepared = await adapter.prepare(request);
		if (!prepared.ok) return { prepared: prepared.reason };
		const verified = await adapter.verify(prepared.binding);
		if (!verified.ok) return { prepared: `verify:${verified.reason}` };
		return adapter.execute(request, prepared.binding, signal);
	};
	const describeRun = (run: Run) => {
		if ('prepared' in run) return `not proposed: ${run.prepared}`;
		const parts = [`${run.outcome}/${run.delivery}`];
		if (run.reason) parts.push(`reason=${run.reason}`);
		if (run.remoteTask?.taskId) parts.push('task-id=yes');
		if (run.result?.includes('"cancellation":"confirmed"')) parts.push('cancellation=confirmed');
		return parts.join(' ');
	};
	const settled = (run: Run, want: Partial<ExternalExecutionResult>): run is ExternalExecutionResult =>
		!('prepared' in run) &&
		Object.entries(want).every(([key, value]) => run[key as keyof ExternalExecutionResult] === value);
	const cancelled = (run: Run) => !('prepared' in run) && run.result?.includes('"cancellation":"confirmed"') === true;

	const success = await approvedRun('performance-review');
	record(
		DELEGATION_LEG,
		'success: approved delegation → succeeded claim, wrapped, unverified, with the remote task id',
		settled(success, { outcome: 'succeeded', delivery: 'sent' }) &&
			success.result?.startsWith('<untrusted-content') === true &&
			success.result.includes('"verified":false') &&
			typeof success.remoteTask?.taskId === 'string',
		describeRun(success),
	);

	const rejected = await approvedRun('rejecting-review-fixture');
	record(
		DELEGATION_LEG,
		'rejection: the peer declines → failed, sent, peer_declined',
		settled(rejected, { outcome: 'failed', delivery: 'sent', reason: 'peer_declined' }),
		describeRun(rejected),
	);

	const invalid = await approvedRun('invalid-report-fixture');
	record(
		DELEGATION_LEG,
		'invalid result: a wrong report envelope → failed, sent, invalid_answer (no claim)',
		settled(invalid, { outcome: 'failed', delivery: 'sent', reason: 'invalid_answer' }) &&
			!invalid.result?.includes('"status":"claimed"'),
		describeRun(invalid),
	);

	const timedOut = await approvedRun('slow-review-fixture', { timeoutMs: 1500 });
	record(
		DELEGATION_LEG,
		'timeout: the deadline passes mid-task → CancelTask confirmed by the peer',
		settled(timedOut, { outcome: 'failed', delivery: 'sent', reason: 'timeout' }) && cancelled(timedOut),
		describeRun(timedOut),
	);

	const controller = new AbortController();
	setTimeout(() => controller.abort(), 1000);
	const aborted = await approvedRun('slow-review-fixture', {}, controller.signal);
	record(
		DELEGATION_LEG,
		'cancellation: the caller aborts mid-task → CancelTask confirmed by the peer',
		settled(aborted, { outcome: 'failed', delivery: 'sent', reason: 'aborted' }) && cancelled(aborted),
		describeRun(aborted),
	);

	const turn = createDelegationBudget({ depth: 0, proposedInConversation: 0 });
	const first = turn.take();
	const second = turn.take();
	const nested = createDelegationBudget({ depth: 1, proposedInConversation: 0 }).take();
	record(
		DELEGATION_LEG,
		'budget/depth: a second delegation in a turn, and any from a delegated turn, is refused before proposing',
		first.ok && !second.ok && second.refusal === 'turn_budget' && !nested.ok && nested.refusal === 'depth',
		`second=${second.ok ? 'ok' : second.refusal} nested=${nested.ok ? 'ok' : nested.refusal}`,
	);

	const notAllowed = await approvedRun('malformed-findings-fixture');
	record(
		DELEGATION_LEG,
		'authorization: a skill the card offers but the operator did not allow is refused before proposing',
		'prepared' in notAllowed && notAllowed.prepared === 'skill_not_allowed',
		describeRun(notAllowed),
	);
}

/** (b) The Python client against v10r's server, on Bun.serve. */
async function pythonClientLeg(model: ArchitectureModel): Promise<string | null> {
	const server = Bun.serve({
		hostname: '127.0.0.1',
		port: 0,
		fetch(request) {
			const url = new URL(request.url);
			const origin = url.origin;
			if (request.method === 'GET' && url.pathname === '/.well-known/agent-card.json') {
				return Response.json(buildArchitectureReviewCard(origin));
			}
			if (url.pathname === '/api/a2a' && request.method === 'POST') return respondToA2aPost(request, origin);
			return new Response('not found', { status: 404 });
		},
	});
	const dir = mkdtempSync(join(tmpdir(), 'a2a-interop-'));
	try {
		const modelPath = join(dir, 'model.json');
		writeFileSync(modelPath, JSON.stringify(model));
		// Async, never spawnSync: a blocked event loop would leave Bun.serve unable to answer the probe.
		const probe = Bun.spawn(
			uvPython(PROBE_SCRIPT, ['--base-url', `http://127.0.0.1:${server.port}`, '--model', modelPath]),
			{ stdout: 'pipe', stderr: 'pipe', timeout: STARTUP_MS, env: LOOPBACK_ENV },
		);
		const [stdout, stderr] = await Promise.all([new Response(probe.stdout).text(), new Response(probe.stderr).text()]);
		await probe.exited;
		const last = stdout.trim().split('\n').at(-1) ?? '';
		try {
			const parsed = JSON.parse(last) as { sdk: string; checks: { name: string; ok: boolean; detail: string }[] };
			for (const entry of parsed.checks) record(PY_LEG, entry.name, entry.ok, entry.detail);
			return parsed.sdk;
		} catch {
			record(PY_LEG, 'probe: printed its JSON result', false, stderr.trim().slice(-400));
			return null;
		}
	} finally {
		rmSync(dir, { recursive: true, force: true });
		server.stop(true);
	}
}

/** `@a2a-js/sdk`'s package.json, wherever module resolution finds the package (a worktree may borrow its parent's). */
function sdkPackageJson(): string {
	let dir = dirname(Bun.resolveSync('@a2a-js/sdk', import.meta.dir));
	while (
		!existsSync(join(dir, 'package.json')) ||
		!readFileSync(join(dir, 'package.json'), 'utf8').includes('"@a2a-js/sdk"')
	) {
		const parent = dirname(dir);
		if (parent === dir) throw new Error('@a2a-js/sdk package.json not found');
		dir = parent;
	}
	return join(dir, 'package.json');
}

async function main(): Promise<number> {
	const model = sampleReviewModel();
	const port = await freePort();
	const origin = `http://127.0.0.1:${port}`;
	const peer = Bun.spawn(uvPython(PEER_SCRIPT, ['--port', String(port), '--allow-fixtures']), {
		stdout: 'ignore',
		stderr: 'pipe',
		env: LOOPBACK_ENV,
	});
	let pythonSdk: string | null = null;
	try {
		if (await waitForCard(origin, peer)) {
			try {
				await jsClientLeg(origin, model);
			} catch (error) {
				record(JS_LEG, 'leg ran to the end', false, error instanceof Error ? error.message : String(error));
			}
			try {
				await delegationLeg(origin, model);
			} catch (error) {
				record(DELEGATION_LEG, 'leg ran to the end', false, error instanceof Error ? error.message : String(error));
			}
		} else {
			const stderr = peer.exitCode === null ? '' : await new Response(peer.stderr as ReadableStream).text();
			record(
				JS_LEG,
				'python peer started',
				false,
				stderr.trim().slice(-400) || 'no agent card within the startup budget',
			);
		}
		pythonSdk = await pythonClientLeg(model);
	} finally {
		peer.kill();
		await peer.exited;
	}

	const jsSdk = JSON.parse(readFileSync(sdkPackageJson(), 'utf8')).version;
	const passed = checks.filter((entry) => entry.ok).length;
	const report = {
		protocol: A2A_PROTOCOL_VERSION,
		versions: { '@a2a-js/sdk': jsSdk, 'a2a-sdk (python)': pythonSdk },
		model: { id: model.id, nodes: model.nodes.length, connections: model.connections.length },
		summary: { passed, failed: checks.length - passed, total: checks.length },
		checks,
		tck: {
			run: false,
			reason:
				'a2a-tck (github.com/a2aproject/a2a-tck) has no PyPI package and no tagged release, so it can only run from a checkout. Attempted 2026-11-24 from a cloud session: the checkout was refused (GitHub access limited to the session repository) and `uv run --with a2a-tck` finds no such package. Run it locally with `./run_tck.py --sut-host http://127.0.0.1:<port> --transport jsonrpc` against the Bun.serve SUT this script starts.',
		},
	};
	writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, '\t')}\n`);

	const width = Math.max(...checks.map((entry) => entry.name.length));
	console.log(`A2A interop — protocol ${A2A_PROTOCOL_VERSION}, @a2a-js/sdk ${jsSdk}, a2a-sdk ${pythonSdk ?? '?'}\n`);
	let leg = '';
	for (const entry of checks) {
		if (entry.leg !== leg) {
			leg = entry.leg;
			console.log(`  ${leg}`);
		}
		console.log(`    ${entry.ok ? 'PASS' : 'FAIL'}  ${entry.name.padEnd(width)}  ${entry.detail}`);
	}
	console.log(`\n${passed}/${checks.length} passed — report: scripts/a2a/interop-report.json`);
	return passed === checks.length && checks.length > 0 ? 0 : 1;
}

process.exit(await main());
