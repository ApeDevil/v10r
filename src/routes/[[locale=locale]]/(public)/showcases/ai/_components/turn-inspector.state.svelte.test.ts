/**
 * The inspector state's decisions — what a browser pass cannot pin reliably:
 *   - a live turn that is not there is null, never the fixture standing in;
 *   - `inspect()` re-reads the thread even for the conversation already selected;
 *   - a response that arrives after a newer request is dropped;
 *   - a row that has not landed yet is read again, then gives up honestly;
 *   - following the thread: a running turn renders from its snapshot, a finished one is read.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatbotGrounded } from '$lib/showcases/ai/fixtures/chatbot-grounded';
import { NODE_IDS } from '$lib/showcases/ai/inspector';
import type { TurnTrace, TurnTraceSnapshot } from '$lib/types/turn-trace';
import { TURN_READ_RETRY_MS, TurnInspectorState } from './turn-inspector.state.svelte';

const trace = chatbotGrounded.trace;
const profile = chatbotGrounded.profile;

type Handler = (url: string) => { status: number; body?: unknown } | Promise<{ status: number; body?: unknown }>;

/** Routes by prefix; a handler may return a promise so a test can hold one response back. */
function stubFetch(handlers: Record<string, Handler>) {
	const calls: string[] = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string) => {
			calls.push(url);
			const key = Object.keys(handlers).find((k) => url.startsWith(k));
			const reply = key ? await handlers[key](url) : { status: 404 };
			return {
				ok: reply.status >= 200 && reply.status < 300,
				status: reply.status,
				json: async () => ({ data: reply.body }),
			} as unknown as Response;
		}),
	);
	return calls;
}

const thread = (messageId: string, question = 'Q?', answer = 'A.') => ({
	messages: [
		{ id: 'u1', role: 'user', content: question },
		{ id: messageId, role: 'assistant', content: answer },
	],
	turns: [
		{
			messageId,
			surface: 'chatbot',
			outcome: 'ok',
			activations: [],
			citations: [],
			cited: [],
			modelCalls: 1,
			toolExecutions: 0,
			createdAt: '2026-09-13T10:00:00.000Z',
		},
	],
});

const traceFor = (messageId: string): TurnTrace => ({ ...trace, messageId, conversationId: 'c1' });

const snapshotFor = (messageId: string, finished: boolean): TurnTraceSnapshot => {
	const { blocks, toolExecutions, toolset: _t, createdAt: _c, proposal: _p, bodies: _b, ...rest } = trace;
	return {
		...rest,
		messageId,
		conversationId: 'c1',
		blocks: blocks.map(({ text: _text, ...outline }) => outline),
		toolExecutions: toolExecutions.map(({ input: _i, output: _o, ...outline }) => outline),
		attempts: [{ attemptIndex: 0, providerId: 'google', modelId: 'm', outcome: finished ? 'ok' : 'started' }],
		bodies: 'persisted',
	};
};

const observed = (messageId: string, finished: boolean) => ({
	conversationId: 'c1',
	messageId,
	role: 'assistant',
	trace: snapshotFor(messageId, finished),
	question: 'Q?',
	answer: 'A.',
});

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('TurnInspectorState — what is on the page', () => {
	it('shows the fixture on the recorded source and nothing — not the fixture — while live has nothing', async () => {
		stubFetch({ '/api/ai/conversations?': () => ({ status: 200, body: { items: [] } }) });
		const state = new TurnInspectorState('chatbot', [chatbotGrounded]);
		expect(state.status).toBe('recorded');
		expect(state.current).toBe(chatbotGrounded);
		await state.showLive();
		expect(state.status).toBe('idle');
		expect(state.current).toBeNull();
		expect(state.tree).toEqual([]);
		expect(state.graph).toBeNull();
	});

	it('re-reads the thread for the conversation already selected, so a new turn is listed', async () => {
		const calls = stubFetch({
			'/api/ai/conversations?': () => ({ status: 200, body: { items: [] } }),
			'/api/ai/conversations/c1/turns/': (url) => ({ status: 200, body: traceFor(url.split('/').at(-1) ?? '') }),
			'/api/ai/conversations/c1': () => ({ status: 200, body: thread('m2') }),
			'/api/ai/profiles/': () => ({ status: 200, body: profile }),
		});
		const state = new TurnInspectorState('chatbot', [chatbotGrounded]);
		await state.inspect('c1', 'm2');
		await state.inspect('c1', 'm2');
		expect(calls.filter((u) => u === '/api/ai/conversations/c1')).toHaveLength(2);
		expect(state.status).toBe('ready');
		expect(state.current?.trace.messageId).toBe('m2');
		expect(state.current?.question).toBe('Q?');
		expect(state.current?.answer).toBe('A.');
		expect(state.follow).toBe(false);
	});

	it('drops a response that arrives after a newer pick', async () => {
		let releaseA: (() => void) | undefined;
		stubFetch({
			'/api/ai/conversations?': () => ({ status: 200, body: { items: [] } }),
			'/api/ai/conversations/c1/turns/a': () =>
				new Promise((resolve) => {
					releaseA = () => resolve({ status: 200, body: traceFor('a') });
				}),
			'/api/ai/conversations/c1/turns/b': () => ({ status: 200, body: traceFor('b') }),
			'/api/ai/conversations/c1': () => ({ status: 200, body: thread('b') }),
			'/api/ai/profiles/': () => ({ status: 200, body: profile }),
		});
		const state = new TurnInspectorState('chatbot', [chatbotGrounded]);
		await state.inspect('c1', 'b');
		const first = state.pickTurn('a');
		const second = state.pickTurn('b');
		await second;
		expect(state.live?.trace.messageId).toBe('b');
		releaseA?.();
		await first;
		expect(state.live?.trace.messageId).toBe('b');
		expect(state.status).toBe('ready');
	});

	it('reads a row that has not landed again, briefly, then gives up honestly', async () => {
		let misses = 2;
		stubFetch({
			'/api/ai/conversations?': () => ({ status: 200, body: { items: [] } }),
			'/api/ai/conversations/c1/turns/m3': () =>
				misses-- > 0 ? { status: 404 } : { status: 200, body: traceFor('m3') },
			'/api/ai/conversations/c1': () => ({ status: 200, body: thread('m3') }),
			'/api/ai/profiles/': () => ({ status: 200, body: profile }),
		});
		const state = new TurnInspectorState('chatbot', [chatbotGrounded]);
		const reading = state.inspect('c1', 'm3', { retries: 3 });
		await vi.advanceTimersByTimeAsync(TURN_READ_RETRY_MS * 3);
		await reading;
		expect(state.status).toBe('ready');
		expect(state.retrying).toBe(false);

		misses = 10;
		const failing = state.inspect('c1', 'm3', { retries: 3 });
		await vi.advanceTimersByTimeAsync(TURN_READ_RETRY_MS * 4);
		await failing;
		expect(state.status).toBe('error');
		expect(state.error).toBe('failed');
		expect(state.current).toBeNull();
	});

	it('marks the profile as drifted when its declared texts differ from the turn’s recorded ones', async () => {
		const changed = profile
			? { ...profile, identity: { ...profile.identity, text: `${profile.identity.text} (revised)` } }
			: null;
		stubFetch({
			'/api/ai/conversations?': () => ({ status: 200, body: { items: [] } }),
			'/api/ai/conversations/c1/turns/': () => ({ status: 200, body: traceFor('m4') }),
			'/api/ai/conversations/c1': () => ({ status: 200, body: thread('m4') }),
			'/api/ai/profiles/': () => ({ status: 200, body: changed }),
		});
		const state = new TurnInspectorState('chatbot', [chatbotGrounded]);
		await state.inspect('c1', 'm4');
		expect(state.profileDrift).toBe(true);
	});
});

describe('TurnInspectorState — following the thread', () => {
	it('renders a running turn from its snapshot, bodies pending, and reads it once it finishes', async () => {
		const calls = stubFetch({
			'/api/ai/conversations?': () => ({ status: 200, body: { items: [] } }),
			'/api/ai/conversations/c1/turns/': () => ({ status: 200, body: traceFor('m5') }),
			'/api/ai/conversations/c1': () => ({ status: 200, body: thread('m5') }),
			'/api/ai/profiles/': () => ({ status: 200, body: profile }),
		});
		const state = new TurnInspectorState('chatbot', [chatbotGrounded]);
		state.observeThread(observed('m5', false));
		expect(state.status).toBe('streaming');
		expect(state.current?.provenance.kind).toBe('live');
		expect(state.current?.trace.bodies).toBe('persisted');
		expect(state.current?.trace.toolset).toEqual([]);
		expect(state.graph?.nodes.some((n) => n.id === NODE_IDS.answer)).toBe(true);
		expect(calls).toHaveLength(0);

		state.observeThread(observed('m5', true));
		await vi.advanceTimersByTimeAsync(0);
		await vi.waitFor(() => expect(state.status).toBe('ready'));
		expect(state.streaming).toBeNull();
		expect(state.current?.trace.messageId).toBe('m5');
		expect(state.follow).toBe(true);
		// A repeated observation of the same finished turn does not read it again.
		const reads = calls.filter((u) => u.includes('/turns/m5')).length;
		state.observeThread(observed('m5', true));
		expect(calls.filter((u) => u.includes('/turns/m5'))).toHaveLength(reads);
	});

	it('reads the turn behind a reloaded summary — it exists only for a finished turn', async () => {
		const calls = stubFetch({
			'/api/ai/conversations?': () => ({ status: 200, body: { items: [] } }),
			'/api/ai/conversations/c1/turns/': () => ({ status: 200, body: traceFor('m6') }),
			'/api/ai/conversations/c1': () => ({ status: 200, body: thread('m6') }),
			'/api/ai/profiles/': () => ({ status: 200, body: profile }),
		});
		const state = new TurnInspectorState('chatbot', [chatbotGrounded]);
		state.observeThread({ ...observed('m6', true), trace: { outcome: 'ok', citations: [] } });
		await vi.waitFor(() => expect(state.status).toBe('ready'));
		expect(calls.some((u) => u.includes('/turns/m6'))).toBe(true);
	});

	it('ignores a user message, a message without a trace, and everything while not following', () => {
		const calls = stubFetch({});
		const state = new TurnInspectorState('chatbot', [chatbotGrounded]);
		state.observeThread({ ...observed('m6', true), role: 'user' });
		state.observeThread({ ...observed('m6', true), trace: null });
		expect(state.status).toBe('recorded');
		state.follow = false;
		state.observeThread(observed('m6', false));
		expect(state.status).toBe('recorded');
		expect(calls).toHaveLength(0);
	});

	it('follows again on request, picking up the last thing it saw', () => {
		stubFetch({});
		const state = new TurnInspectorState('chatbot', [chatbotGrounded]);
		state.follow = false;
		state.observeThread(observed('m7', false));
		expect(state.status).toBe('recorded');
		state.followLatest();
		expect(state.follow).toBe(true);
		expect(state.status).toBe('streaming');
		expect(state.current?.trace.messageId).toBe('m7');
	});

	it('never follows on the deskbot page', () => {
		stubFetch({});
		const state = new TurnInspectorState('deskbot', [chatbotGrounded]);
		state.observeThread(observed('m8', false));
		expect(state.status).toBe('recorded');
	});
});
