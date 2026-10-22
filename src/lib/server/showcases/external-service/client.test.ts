/**
 * The adapter against a real socket. A `node:http` server on an ephemeral port plays the
 * service — including every way a real one can misbehave — so classification, bounds,
 * retry and redaction are proven over actual HTTP, not a mocked `fetch`.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startDeadline } from '$lib/server/http/deadline';
import { callService, parseServiceTiming, SERVICE_OPERATIONS } from './client';
import { MAX_RESPONSE_BYTES } from './config';
import { EVALUATION_SCENARIOS } from './scenarios';
import type { ServiceTarget } from './targets';

const TOKEN = 'client-test-credential-0123456789abcdef';

interface Received {
	method: string;
	url: string;
	headers: http.IncomingHttpHeaders;
	body: string;
}

type Responder = (request: Received, res: http.ServerResponse) => void;

let server: http.Server;
let target: ServiceTarget;
let responder: Responder;
let received: Received[] = [];

const json = (res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
	res.writeHead(status, { 'content-type': 'application/json', ...headers });
	res.end(JSON.stringify(body));
};

const LIVE = { status: 'live' };
const STATUS = {
	service: 'order-rules',
	release: '0.1.0',
	uptimeMs: 1234,
	operations: ['evaluate'],
	limits: { maxEvents: 64, maxAmountCents: 100_000_000, maxBodyBytes: 8192 },
};
const ACCEPTED = {
	outcome: 'accepted',
	steps: [{ index: 0, event: 'pay', from: 'placed', to: 'paid' }],
	finalState: 'paid',
	paidCents: 4990,
	refundedCents: 0,
};

beforeAll(async () => {
	server = http.createServer(async (req, res) => {
		const chunks: Buffer[] = [];
		for await (const chunk of req) chunks.push(chunk as Buffer);
		const request = {
			method: req.method ?? '',
			url: req.url ?? '',
			headers: req.headers,
			body: Buffer.concat(chunks).toString('utf8'),
		};
		received.push(request);
		responder(request, res);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	target = { id: 'local', origin: `http://127.0.0.1:${port}`, token: TOKEN };
});

afterAll(async () => {
	server.closeAllConnections();
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

// Failures log one line each by design; keep the test output to the assertions.
beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	received = [];
	vi.restoreAllMocks();
});

const deadline = (ms = 2_000) => ({ deadline: startDeadline(ms) });

describe('callService — success', () => {
	it('sends the credential, a request id and nothing caller-controlled', async () => {
		responder = (_, res) => json(res, 200, LIVE, { 'server-timing': 'app;dur=0.250' });
		const call = await callService(target, SERVICE_OPERATIONS.live, undefined, {
			...deadline(),
			requestId: 'req-fixed-1',
		});

		expect(call).toMatchObject({ ok: true, data: LIVE, httpStatus: 200, requestId: 'req-fixed-1' });
		expect(received).toHaveLength(1);
		expect(received[0]).toMatchObject({ method: 'GET', url: '/health/live' });
		expect(received[0].headers.authorization).toBe(`Bearer ${TOKEN}`);
		expect(received[0].headers['x-request-id']).toBe('req-fixed-1');
	});

	it('separates the service’s own time from the round trip', async () => {
		responder = (_, res) => json(res, 200, STATUS, { 'server-timing': 'app;dur=0.250' });
		const call = await callService(target, SERVICE_OPERATIONS.status, undefined, deadline());
		expect(call.ok).toBe(true);
		expect(call.timing.serviceMs).toBe(0.25);
		expect(call.timing.roundTripMs).toBeGreaterThan(0);
		expect(call.timing.adapterMs).toBeGreaterThanOrEqual(0);
		expect(call.timing.attempts).toBe(1);
	});

	it('posts the validated request body as JSON', async () => {
		responder = (_, res) => json(res, 200, ACCEPTED);
		const call = await callService(target, SERVICE_OPERATIONS.evaluate, EVALUATION_SCENARIOS.fulfilled, deadline());
		expect(call.ok).toBe(true);
		expect(received[0].headers['content-type']).toBe('application/json');
		expect(JSON.parse(received[0].body)).toEqual(EVALUATION_SCENARIOS.fulfilled);
	});

	it('ignores fields the service adds later (tolerant reader)', async () => {
		responder = (_, res) => json(res, 200, { ...STATUS, region: 'frankfurt' });
		const call = await callService(target, SERVICE_OPERATIONS.status, undefined, deadline());
		expect(call.ok && call.data).toEqual(STATUS);
	});
});

describe('callService — refusals and failures', () => {
	it('refuses an invalid request before anything is sent', async () => {
		responder = (_, res) => json(res, 200, ACCEPTED);
		const call = await callService(target, SERVICE_OPERATIONS.evaluate, { totalCents: 0, events: [] }, deadline());
		expect(call).toMatchObject({ ok: false, kind: 'invalid_request', httpStatus: null });
		expect(received).toHaveLength(0);
	});

	it.each([
		[401, 'unauthorized'],
		[413, 'too_large'],
		[408, 'timed_out'],
		[404, 'service_error'],
		[500, 'service_error'],
		[503, 'service_error'],
	] as const)('classifies HTTP %i as %s, with a fixed message', async (status, kind) => {
		responder = (_, res) => json(res, status, { error: { code: 'x', message: 'upstream detail <script>' } });
		const call = await callService(target, SERVICE_OPERATIONS.status, undefined, deadline());
		expect(call).toMatchObject({ ok: false, kind, httpStatus: status });
		expect(!call.ok && call.message).not.toContain('upstream detail');
	});

	it('passes on the service’s validation message for a 400, bounded', async () => {
		responder = (_, res) =>
			json(res, 400, {
				error: { code: 'invalid_request', message: `/totalCents: must be positive${'!'.repeat(500)}` },
			});
		const call = await callService(target, SERVICE_OPERATIONS.evaluate, EVALUATION_SCENARIOS.fulfilled, deadline());
		expect(call).toMatchObject({ ok: false, kind: 'invalid_request', httpStatus: 400 });
		expect(!call.ok && call.message.startsWith('/totalCents: must be positive')).toBe(true);
		expect(!call.ok && call.message.length).toBeLessThanOrEqual(240);
	});

	it.each([
		['not JSON', (res: http.ServerResponse) => res.writeHead(200).end('<html>proxy error page</html>')],
		['the wrong shape', (res: http.ServerResponse) => json(res, 200, { status: 'up' })],
		['a renamed field', (res: http.ServerResponse) => json(res, 200, { ...STATUS, uptime_ms: 1, uptimeMs: undefined })],
		['oversized', (res: http.ServerResponse) => json(res, 200, { ...STATUS, pad: 'x'.repeat(MAX_RESPONSE_BYTES) })],
	])('rejects a 2xx answer that is %s as malformed_response', async (_, respond) => {
		responder = (_req, res) => respond(res);
		const call = await callService(target, SERVICE_OPERATIONS.status, undefined, deadline());
		expect(call).toMatchObject({ ok: false, kind: 'malformed_response', httpStatus: 200 });
	});

	it('does not follow a redirect with the credential attached', async () => {
		responder = (request, res) => {
			if (request.url === '/elsewhere') return json(res, 200, LIVE);
			res.writeHead(302, { location: '/elsewhere' }).end();
		};
		const call = await callService(target, SERVICE_OPERATIONS.live, undefined, deadline());
		expect(call).toMatchObject({ ok: false, kind: 'service_error', httpStatus: 302 });
		expect(received.map((r) => r.url)).toEqual(['/health/live']);
	});

	it('times out a slow service within the deadline and does not retry it', async () => {
		responder = (_, res) => {
			setTimeout(() => json(res, 200, LIVE), 1_000);
		};
		const started = performance.now();
		const call = await callService(target, SERVICE_OPERATIONS.live, undefined, deadline(150));
		expect(call).toMatchObject({ ok: false, kind: 'timed_out', httpStatus: null });
		expect(call.timing.attempts).toBe(1);
		expect(performance.now() - started).toBeLessThan(900);
	});

	it('classifies a refused connection as unreachable, retrying idempotent operations once', async () => {
		const closed = await closedPortTarget();
		const call = await callService(closed, SERVICE_OPERATIONS.status, undefined, deadline());
		expect(call).toMatchObject({ ok: false, kind: 'unreachable', httpStatus: null });
		expect(call.timing.attempts).toBe(2);
	});

	it('never retries an operation not declared idempotent', async () => {
		const closed = await closedPortTarget();
		const once = { ...SERVICE_OPERATIONS.evaluate, idempotent: false };
		const call = await callService(closed, once, EVALUATION_SCENARIOS.fulfilled, deadline());
		expect(call).toMatchObject({ ok: false, kind: 'unreachable' });
		expect(call.timing.attempts).toBe(1);
	});
});

describe('callService — secrets', () => {
	it('keeps the credential and origin out of results and log lines', async () => {
		const warn = vi.mocked(console.warn);
		const outcomes = [];
		for (const status of [200, 401, 500]) {
			responder = (_, res) => json(res, status, status === 200 ? STATUS : { error: { code: 'x', message: TOKEN } });
			outcomes.push(await callService(target, SERVICE_OPERATIONS.status, undefined, deadline()));
		}
		outcomes.push(await callService(await closedPortTarget(), SERVICE_OPERATIONS.status, undefined, deadline()));

		const surfaced = JSON.stringify(outcomes) + JSON.stringify(warn.mock.calls);
		expect(warn).toHaveBeenCalled();
		expect(surfaced).not.toContain(TOKEN);
		expect(surfaced).not.toContain(target.origin);
	});
});

describe('parseServiceTiming', () => {
	it.each([
		['app;dur=1.5', 1.5],
		['db;dur=9, app;desc="handler";dur=0.042', 0.042],
		['total;dur=3', null],
		['app;dur=-1', null],
		['app;dur=abc', null],
		[null, null],
	])('%s → %s', (header, expected) => {
		expect(parseServiceTiming(header)).toBe(expected);
	});
});

/** A target on a port that was open a moment ago and is now closed: connection refused. */
async function closedPortTarget(): Promise<ServiceTarget> {
	const probe = http.createServer();
	await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
	const { port } = probe.address() as AddressInfo;
	await new Promise<void>((resolve) => probe.close(() => resolve()));
	return { id: 'local', origin: `http://127.0.0.1:${port}`, token: TOKEN };
}
