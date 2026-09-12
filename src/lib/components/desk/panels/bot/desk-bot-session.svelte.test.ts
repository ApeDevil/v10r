/**
 * The approval run, driven through the session with the network stubbed: the status the
 * server reports is the phase the card gets, completed steps' effects reach the desk even
 * when the plan failed, the receipt message joins the thread once, a lost response is
 * `unknown` until the status route answers, and nothing may start while one is in flight.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProposalOutcome } from '$lib/types/ai-proposal';

/**
 * The SDK's `Chat` stands in as the fields the session touches; the run under test is the
 * session's own approval logic, not the stream. (`@ai-sdk/svelte` cannot load in the unit
 * lane: its nested `ai` 5 trips on the workspace's zod.)
 */
vi.mock('@ai-sdk/svelte', () => ({
	Chat: class {
		messages: unknown[] = [];
		status = 'ready';
		error: Error | undefined = undefined;
		stop = vi.fn(async () => {});
		sendMessage = vi.fn();
	},
}));

const { DeskBotSession } = await import('./desk-bot-session.svelte');
type DeskBotSink = import('./desk-bot-session.svelte').DeskBotSink;

const fetchMock = vi.fn();
const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify({ data }), { status, headers: { 'content-type': 'application/json' } });

const outcome = (over: Partial<ProposalOutcome> = {}): ProposalOutcome => ({
	id: 'prp_1',
	status: 'executed',
	steps: [
		{
			stepIndex: 0,
			toolName: 'desk_update_cells',
			kind: 'ok',
			output: { fileId: 'fil_a', version: 3 },
			errorMessage: null,
		},
	],
	failureMessage: null,
	effects: [{ type: 'desk:refresh_file', fileId: 'fil_a' }],
	receiptMessage: { id: 'msg_receipt', text: 'Ran the approved plan (1 of 1 step).' },
	expiresAt: '2026-09-12T09:00:00.000Z',
	...over,
});

function sink(): DeskBotSink & { effects: unknown[] } {
	const effects: unknown[] = [];
	return {
		effects,
		dispatchEffect: (e) => {
			effects.push(e);
		},
		awaitFileRefreshed: async (fileId) => ({ fileId, version: 3, ok: true }),
	};
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('DeskBotSession approval run', () => {
	it('moves through approving to the reported status, dispatches effects, appends the receipt once', async () => {
		fetchMock.mockResolvedValueOnce(json(outcome()));
		const session = new DeskBotSession();
		const desk = sink();
		session.attach(desk);

		const run = session.approve('prp_1');
		expect(session.runFor('prp_1').phase).toBe('approving');
		expect(session.isApproving).toBe(true);
		await run;

		expect(session.runFor('prp_1')).toMatchObject({ phase: 'executed', steps: [{ kind: 'ok' }] });
		expect(desk.effects).toEqual([{ type: 'desk:refresh_file', fileId: 'fil_a' }]);
		expect(session.chat.messages.map((m) => m.id)).toEqual(['msg_receipt']);
		expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/ai/proposals/prp_1/approve');

		// A later reconcile of the same settled run changes nothing on the desk.
		fetchMock.mockResolvedValueOnce(json(outcome()));
		await session.reconcile('prp_1');
		expect(desk.effects).toHaveLength(1);
		expect(session.chat.messages).toHaveLength(1);
	});

	it('a status read that arrives after the verdict never regresses a settled run', async () => {
		fetchMock.mockResolvedValueOnce(json(outcome()));
		const session = new DeskBotSession();
		await session.approve('prp_1');
		fetchMock.mockResolvedValueOnce(
			json(outcome({ status: 'executing', steps: [], effects: [], receiptMessage: null })),
		);
		await session.reconcile('prp_1');
		expect(session.runFor('prp_1').phase).toBe('executed');
	});

	it('a failed plan still refreshes what its completed steps changed and says why it stopped', async () => {
		fetchMock.mockResolvedValueOnce(json(outcome({ status: 'failed', failureMessage: 'conflict' })));
		const session = new DeskBotSession();
		const desk = sink();
		session.attach(desk);
		await session.approve('prp_1');
		expect(session.runFor('prp_1')).toMatchObject({ phase: 'failed', failureMessage: 'conflict' });
		expect(desk.effects).toHaveLength(1);
	});

	it('a 409 is not a verdict: the status route is', async () => {
		fetchMock
			.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'proposal_expired' } }), { status: 409 }))
			.mockResolvedValueOnce(json(outcome({ status: 'expired', steps: [], effects: [], receiptMessage: null })));
		const session = new DeskBotSession();
		await session.approve('prp_1');
		expect(session.runFor('prp_1').phase).toBe('expired');
		expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/ai/proposals/prp_1');
	});

	it('a lost response is unknown, then whatever the server says', async () => {
		fetchMock.mockRejectedValueOnce(new TypeError('network down')).mockResolvedValueOnce(json(outcome()));
		const session = new DeskBotSession();
		await session.approve('prp_1');
		expect(session.runFor('prp_1').phase).toBe('executed');
	});

	it('effects that arrive with no panel attached wait for the next attach', async () => {
		fetchMock.mockResolvedValueOnce(json(outcome()));
		const session = new DeskBotSession();
		await session.approve('prp_1');
		const desk = sink();
		session.attach(desk);
		expect(desk.effects).toEqual([{ type: 'desk:refresh_file', fileId: 'fil_a' }]);
	});

	it('refuses a second decision while one is in flight, and a new chat too', async () => {
		let release: (value: Response) => void = () => {};
		fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (release = r)));
		const session = new DeskBotSession();
		const first = session.approve('prp_1');
		await session.approve('prp_2');
		await session.reject('prp_2');
		expect(session.runFor('prp_2').phase).toBe('pending');
		session.newChat();
		expect(session.runFor('prp_1').phase).toBe('approving');
		release(json(outcome()));
		await first;
		expect(session.runFor('prp_1').phase).toBe('executed');
	});
});
