import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GENERATIVE_SURFACE_SCENARIOS } from '#lib/generative-ui/fixtures/index.ts';
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

/**
 * A multi-turn case against a scripted stand-in: turn 1 renders a form surface, turn 2 is a
 * press on it (sent with the thread as history and a surfaceAction record), whose answer
 * updates the surface; the verbatim resend is refused as a duplicate.
 */
describe('runEval with a scripted follow-up press', () => {
	const form = GENERATIVE_SURFACE_SCENARIOS.find((s) => s.id === 'requirements-form');
	if (!form) throw new Error('fixture missing');
	const renderPart = (toolCallId: string, messages: unknown[]) => ({
		type: 'tool-render_surface',
		toolCallId,
		state: 'output-available',
		input: {},
		output: { ok: true, surfaceId: 'requirements', messages },
	});
	const posts: { body: Record<string, unknown> }[] = [];
	let turnsRecorded = 0;
	let admitted = new Set<string>();

	const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(String(input));
		const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
			new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
		if (init?.method === 'POST') {
			const body = JSON.parse(String(init.body)) as Record<string, unknown>;
			posts.push({ body });
			const press = body.surfaceAction as { eventId: string } | undefined;
			if (press) {
				if (admitted.has(press.eventId))
					return json(409, { error: { code: 'surface_action_rejected', message: 'duplicate_event' } });
				admitted.add(press.eventId);
			}
			turnsRecorded += 1;
			return new Response('data: {"type":"finish"}\n\n', {
				status: 200,
				headers: { 'X-Conversation-Id': 'conv-mt' },
			});
		}
		if (init?.method === 'DELETE') return new Response(null, { status: 204 });
		if (url.pathname === '/api/ai/conversations/conv-mt') {
			const messages = [
				{ id: 'u1', role: 'user', content: 'Ask me', parts: null },
				{ id: 'a1', role: 'assistant', content: 'Here is a form.', parts: [renderPart('call_1', form.messages)] },
				...(turnsRecorded > 1
					? [
							{ id: 'u2', role: 'user', content: 'Sent from the view: collect_requirements', parts: [] },
							{ id: 'a2', role: 'assistant', content: 'Thanks.', parts: [renderPart('call_2', [])] },
						]
					: []),
			];
			const turns = ['a1', 'a2'].slice(0, turnsRecorded).map((messageId) => ({ messageId, surface: 'chatbot' }));
			return json(200, { data: { messages, turns } });
		}
		const turnOf = url.pathname.match(/\/turns\/(a\d)$/)?.[1];
		if (turnOf) {
			const call = turnOf === 'a1' ? 'call_1' : 'call_2';
			const output = { ok: true, surfaceId: 'requirements', messages: turnOf === 'a1' ? form.messages : [] };
			return json(200, {
				data: {
					outcome: 'ok',
					proposalId: null,
					citations: [],
					toolExecutions: [{ toolName: 'render_surface', toolCallId: call, status: 'success', output }],
				},
			});
		}
		return json(404, { error: 'not_found' });
	}) as typeof fetch;

	it('grades each turn on its own, presses the Button the thread shows, and grades the refused resend', async () => {
		posts.length = 0;
		turnsRecorded = 0;
		admitted = new Set();
		const multiTurn: EvalCase = {
			id: 'form-then-press',
			surface: 'chatbot',
			question: 'Ask me what you need.',
			expect: [{ kind: 'renders-component', component: 'TextField' }],
			followUps: [
				{
					press: { event: 'collect_requirements', values: { '/requirements/name': 'Shop' }, resend: true },
					expect: [{ kind: 'updates-surface' }, { kind: 'refuses-repeated-press' }, { kind: 'outcome', is: 'ok' }],
				},
			],
		};
		const card = await runEval(
			[multiTurn],
			createHttpEvalClient({ base: 'http://eval.test', cookie: COOKIE, fetchImpl, sleep: async () => {} }),
		);
		expect(card.results[0]?.error).toBeUndefined();
		expect(card.results[0]?.grades.map((g) => [g.kind, g.pass])).toEqual([
			['renders-component', true],
			['turn 2: updates-surface', true],
			['turn 2: refuses-repeated-press', true],
			['turn 2: outcome', true],
		]);
		// The press turn sends the stored thread back as history and the press as a data part.
		const pressPost = posts[1]?.body as {
			conversationId: string;
			messages: { role: string; parts: { type: string }[] }[];
			surfaceAction: { renderId: string; action: { context: { requirements: { name: string } } } };
		};
		expect(pressPost.conversationId).toBe('conv-mt');
		expect(pressPost.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
		expect(pressPost.messages.at(-1)?.parts[0]?.type).toBe('data-surface-action');
		expect(pressPost.surfaceAction.renderId).toBe('call_1');
		expect(pressPost.surfaceAction.action.context.requirements.name).toBe('Shop');
		// The resend is the same request: the same event id.
		expect(posts[2]?.body).toEqual(posts[1]?.body);
	});
});
