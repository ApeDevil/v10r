import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EvalCase } from './eval-case';
import { createHttpEvalClient, runEval } from './run-eval';

const COOKIE = 'better-auth.session_token=test';
const seen: { method: string; url: string; cookie?: string; csrf?: string; body?: unknown }[] = [];

/** A stand-in for the dev server: the three routes an eval run touches, in their envelopes. */
let server: Server;
let threadReads = 0;
let base = '';

beforeAll(async () => {
	server = createServer(async (req, res) => {
		let raw = '';
		for await (const chunk of req) raw += chunk;
		seen.push({
			method: req.method ?? '',
			url: req.url ?? '',
			cookie: req.headers.cookie,
			csrf: req.headers['x-requested-with'] as string | undefined,
			body: raw ? JSON.parse(raw) : undefined,
		});
		const json = (status: number, body: unknown, headers: Record<string, string> = {}) => {
			res.writeHead(status, { 'content-type': 'application/json', ...headers });
			res.end(JSON.stringify(body));
		};
		if (req.method === 'POST' && req.url === '/api/ai/chatbot') {
			res.writeHead(200, { 'content-type': 'text/event-stream', 'X-Conversation-Id': 'conv-1' });
			res.end('data: {"type":"finish"}\n\n');
			return;
		}
		if (req.method === 'POST' && req.url === '/api/ai/deskbot') return json(429, { error: 'rate_limited' });
		if (req.method === 'DELETE') {
			res.writeHead(204);
			res.end();
			return;
		}
		if (req.url === '/api/ai/conversations/conv-1') {
			// The first read races the trace being persisted after the response.
			threadReads += 1;
			if (threadReads === 1) return json(200, { data: { messages: [], turns: [] } });
			return json(200, {
				data: {
					messages: [{ id: 'msg-a', content: 'See the forms showcase.' }],
					turns: [{ messageId: 'msg-a', surface: 'chatbot' }],
				},
			});
		}
		if (req.url === '/api/ai/conversations/conv-1/turns/msg-a') {
			return json(200, {
				data: {
					outcome: 'ok',
					proposalId: null,
					toolExecutions: [{ toolName: 'search_catalog', status: 'success' }],
					citations: [{ itemId: 'x', source: 'catalog', match: 'path', path: '/showcases/forms' }],
				},
			});
		}
		json(404, { error: 'not_found' });
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const cases: EvalCase[] = [
	{
		id: 'where-forms',
		surface: 'chatbot',
		question: 'Where are the forms?',
		expect: [
			{ kind: 'calls-tool', tool: 'search_catalog' },
			{ kind: 'cites', path: '/showcases/forms' },
		],
	},
	{
		id: 'desk-list',
		surface: 'deskbot',
		question: 'What files?',
		request: { toolScopes: ['desk:read'] },
		expect: [{ kind: 'outcome', is: 'ok' }],
	},
];

describe('runEval over HTTP', () => {
	it('asks through the surface endpoint, grades the recorded trace, and fails a case it cannot obtain', async () => {
		const card = await runEval(cases, createHttpEvalClient({ base, cookie: COOKIE, sleep: async () => {} }));

		expect(card.results[0]).toMatchObject({ id: 'where-forms', pass: true });
		expect(card.results[1]?.pass).toBe(false);
		expect(card.results[1]?.error).toMatch(/POST \/api\/ai\/deskbot → 429/);
		expect(card.passRate).toBe(0.5);

		const post = seen.find((r) => r.method === 'POST' && r.url === '/api/ai/chatbot');
		expect(post?.cookie).toBe(COOKIE);
		expect(post?.csrf).toBe('sveltekit');
		expect(post?.body).toMatchObject({
			messages: [{ role: 'user', parts: [{ type: 'text', text: 'Where are the forms?' }] }],
		});
		const desk = seen.find((r) => r.url === '/api/ai/deskbot');
		expect(desk?.body).toMatchObject({ toolScopes: ['desk:read'] });
		expect(seen.filter((r) => r.method === 'GET').every((r) => r.cookie === COOKIE && r.csrf === 'sveltekit')).toBe(
			true,
		);
	});
});
