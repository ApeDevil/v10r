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
	revert: null,
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

const reverted = (over: Partial<ProposalOutcome> = {}) =>
	outcome({
		effects: [{ type: 'desk:refresh_file', fileId: 'fil_a' }],
		receiptMessage: { id: 'msg_undo', text: 'Undid the plan (1 of 1 step).' },
		revert: { status: 'reverted', steps: [{ stepIndex: 0, kind: 'ok', errorMessage: null }] },
		...over,
	});

describe('DeskBotSession undo run', () => {
	it('moves through reverting to the reported revert, refreshes what it touched, appends the undo once', async () => {
		fetchMock.mockResolvedValueOnce(json(outcome())).mockResolvedValueOnce(json(reverted()));
		const session = new DeskBotSession();
		const desk = sink();
		session.attach(desk);
		await session.approve('prp_1');

		const undo = session.revert('prp_1');
		expect(session.runFor('prp_1').revert?.phase).toBe('reverting');
		expect(session.isBusy).toBe(true);
		await undo;

		expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/ai/proposals/prp_1/revert');
		expect(session.runFor('prp_1')).toMatchObject({ phase: 'executed', revert: { phase: 'reverted' } });
		expect(desk.effects).toHaveLength(2);
		expect(session.chat.messages.map((m) => m.id)).toEqual(['msg_receipt', 'msg_undo']);

		// A reconcile of the settled undo dispatches nothing again.
		fetchMock.mockResolvedValueOnce(json(reverted()));
		await session.reconcile('prp_1');
		expect(desk.effects).toHaveLength(2);
		expect(session.chat.messages).toHaveLength(2);
	});

	it("a lost undo response keeps the run's receipts and asks the server", async () => {
		fetchMock
			.mockResolvedValueOnce(json(outcome()))
			.mockRejectedValueOnce(new TypeError('network down'))
			.mockRejectedValueOnce(new TypeError('still down'));
		const session = new DeskBotSession();
		await session.approve('prp_1');
		await session.revert('prp_1');
		expect(session.runFor('prp_1')).toMatchObject({
			phase: 'executed',
			steps: [{ kind: 'ok' }],
			revert: { phase: 'unknown' },
		});
	});

	// A revert whose process died is still `reverting` on the server until the status route
	// heals it. Only this client's own request may hold the session busy — never that row.
	it('a server-side reverting never holds the session busy, and attach asks again', async () => {
		fetchMock
			.mockResolvedValueOnce(json(outcome({ revert: { status: 'reverting', steps: [] } })))
			.mockResolvedValueOnce(json(reverted()));
		const session = new DeskBotSession();
		await session.reconcile('prp_1');
		expect(session.runFor('prp_1').revert?.phase).toBe('reverting');
		expect(session.isBusy).toBe(false);

		session.attach(sink());
		await vi.waitFor(() => expect(session.runFor('prp_1').revert?.phase).toBe('reverted'));
	});

	it('a status read that left before the undo never erases a settled undo', async () => {
		fetchMock
			.mockResolvedValueOnce(json(outcome()))
			.mockResolvedValueOnce(json(reverted()))
			.mockResolvedValueOnce(json(outcome()));
		const session = new DeskBotSession();
		await session.approve('prp_1');
		await session.revert('prp_1');
		await session.reconcile('prp_1');
		expect(session.runFor('prp_1').revert?.phase).toBe('reverted');
	});

	it('a refused undo leaves no undo in flight', async () => {
		fetchMock
			.mockResolvedValueOnce(json(outcome()))
			.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'revert_unavailable' } }), { status: 409 }))
			.mockResolvedValueOnce(json(outcome()));
		const session = new DeskBotSession();
		await session.approve('prp_1');
		await session.revert('prp_1');
		expect(session.runFor('prp_1').revert).toBeNull();
		expect(session.isBusy).toBe(false);
	});

	it('offers no second undo once one was asked for', async () => {
		fetchMock.mockResolvedValueOnce(json(outcome())).mockResolvedValueOnce(json(reverted()));
		const session = new DeskBotSession();
		await session.approve('prp_1');
		await session.revert('prp_1');
		await session.revert('prp_1');
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});

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
