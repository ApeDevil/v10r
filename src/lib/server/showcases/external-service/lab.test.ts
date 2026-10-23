/**
 * The lab's orchestration over a scripted `fetch` seam: what is (and is not) sent for each
 * setup and drill, and that the projection the page receives carries no secrets.
 */
import { describe, expect, it, vi } from 'vitest';
import { startDeadline } from '$lib/server/http/deadline';
import { CONTRACT_RELEASE } from '$lib/showcases/external-service/contract.generated';
import { checkTarget, evaluatePreset, runDrill } from './lab';
import { UNVALIDATED_DRILL_REQUEST, WRONG_CREDENTIAL } from './presets';
import type { ResolvedServiceTarget } from './targets';

const TOKEN = 'lab-test-credential-0123456789abcdef0123';
const ORIGIN = 'https://runtime-lab.internal.example';
const configured: ResolvedServiceTarget = {
	id: 'remote',
	setup: 'configured',
	target: { id: 'remote', origin: ORIGIN, token: TOKEN },
};

const respond = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const STATUS = {
	service: 'runtime-lab',
	release: '0.1.0',
	uptimeMs: 10,
	operations: ['evaluate'],
	limits: { maxEvents: 64, maxAmountCents: 100_000_000, maxBodyBytes: 8192 },
};

function scriptedFetch(...answers: Array<Response | Error>) {
	return vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) => {
		const next = answers.shift();
		if (!next) throw new Error('unexpected extra call');
		if (next instanceof Error) throw next;
		return next;
	});
}

const deps = (fetch: ReturnType<typeof scriptedFetch>) => ({ deadline: startDeadline(2_000), fetch });

describe('lab — targets that cannot be called', () => {
	it.each([
		[{ id: 'remote', setup: 'unconfigured' }, 'unconfigured'],
		[{ id: 'remote', setup: 'misconfigured', problem: 'insecure_url' }, 'misconfigured'],
	] as const)('sends nothing for %o', async (resolved, outcome) => {
		const fetch = scriptedFetch();
		const check = await checkTarget(resolved, deps(fetch));
		const evaluation = await evaluatePreset(resolved, 'fulfilled', deps(fetch));
		const drill = await runDrill(resolved, 'credential', deps(fetch));
		expect(fetch).not.toHaveBeenCalled();
		expect(check).toMatchObject({ live: { outcome, requestId: null, timing: null }, status: null, contractSkew: null });
		expect(evaluation.outcome).toBe(outcome);
		expect(drill.outcome).toBe(outcome);
	});
});

describe('lab — checkTarget', () => {
	it('asks for status only once liveness answered', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const down = scriptedFetch(new TypeError('fetch failed'), new TypeError('fetch failed'));
		expect(await checkTarget(configured, deps(down))).toMatchObject({ live: { outcome: 'unreachable' }, status: null });

		const up = scriptedFetch(respond(200, { status: 'live' }), respond(200, STATUS));
		const check = await checkTarget(configured, deps(up));
		expect(check.live.outcome).toBe('ok');
		expect(check.status).toMatchObject({ outcome: 'ok', data: STATUS });
	});

	it('reads the service release against this app’s contract — as a diagnosis, not a refusal', async () => {
		const skewOf = async (release: string) => {
			const fetch = scriptedFetch(respond(200, { status: 'live' }), respond(200, { ...STATUS, release }));
			return checkTarget(configured, deps(fetch));
		};
		expect((await skewOf(CONTRACT_RELEASE)).contractSkew).toBe('none');
		const breaking = await skewOf('99.0.0');
		expect(breaking.contractSkew).toBe('breaking');
		expect(breaking.status?.outcome).toBe('ok');
	});
});

describe('lab — drills change one thing on our side', () => {
	it('credential: sends the fixed wrong bearer and reports the service’s 401', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const fetch = scriptedFetch(respond(401, { error: { code: 'unauthorized', message: 'no' } }));
		const call = await runDrill(configured, 'credential', deps(fetch));
		const headers = fetch.mock.calls[0][1]?.headers as Record<string, string>;
		expect(headers.authorization).toBe(`Bearer ${WRONG_CREDENTIAL}`);
		expect(call).toMatchObject({ outcome: 'unauthorized', httpStatus: 401 });
	});

	it('unvalidated: sends the out-of-bounds body the adapter would have refused', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const fetch = scriptedFetch(
			respond(400, { error: { code: 'invalid_request', message: '/totalCents: out of range' } }),
		);
		const call = await runDrill(configured, 'unvalidated', deps(fetch));
		expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual(UNVALIDATED_DRILL_REQUEST);
		expect(call).toMatchObject({ outcome: 'invalid_request', httpStatus: 400, message: '/totalCents: out of range' });
	});

	it('deadline: a spent budget is refused before anything is sent', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const fetch = scriptedFetch(respond(200, STATUS));
		const call = await runDrill(configured, 'deadline', deps(fetch));
		expect(fetch).not.toHaveBeenCalled();
		expect(call).toMatchObject({ outcome: 'timed_out', httpStatus: null, timing: { attempts: 0 } });
	});
});

describe('lab — projection', () => {
	it.each([
		['success', () => scriptedFetch(respond(200, { status: 'live' }), respond(200, STATUS))],
		[
			'refused credential',
			() => scriptedFetch(respond(200, { status: 'live' }), respond(401, { error: { code: 'x', message: TOKEN } })),
		],
		['nothing answered', () => scriptedFetch(new TypeError(`connect ECONNREFUSED ${ORIGIN}`), new TypeError(ORIGIN))],
	])('gives the page no origin and no credential — %s', async (_, fetch) => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const check = await checkTarget(configured, deps(fetch()));
		const serialized = JSON.stringify(check);
		expect(serialized).not.toContain(TOKEN);
		expect(serialized).not.toContain(ORIGIN);
		expect(serialized).not.toContain('internal.example');
	});

	it('every preset sends a request the contract accepts', async () => {
		for (const preset of ['fulfilled', 'partial_refund', 'ship_unpaid', 'overpaid'] as const) {
			const fetch = scriptedFetch(
				respond(200, { outcome: 'accepted', steps: [], finalState: 'paid', paidCents: 0, refundedCents: 0 }),
			);
			expect((await evaluatePreset(configured, preset, deps(fetch))).outcome).toBe('ok');
			expect(fetch).toHaveBeenCalledTimes(1);
		}
	});
});
