/**
 * The approval run, driven through the session with the network stubbed: the status the
 * server reports is the phase the card gets, completed steps' effects reach the desk even
 * when the plan failed, the receipt message joins the thread once, a lost response is
 * `unknown` until the status route answers, and nothing may start while one is in flight.
 *
 * And the client actions: a call for a client-executed tool is run once and answered with
 * what the handler observed, and the thread goes back to the server on its own only for a
 * result this session just settled — never for a step that ended on a server tool.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProposalOutcome } from '#lib/types/ai-proposal.ts';

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
		/** The SDK's behaviour the session relies on: the output settles the call's part. */
		addToolOutput = vi.fn(async ({ toolCallId, output }: { toolCallId: string; output: unknown }) => {
			this.messages = (this.messages as { parts?: { toolCallId?: string }[] }[]).map((message) => ({
				...message,
				parts: message.parts?.map((part) =>
					part.toolCallId === toolCallId ? { ...part, state: 'output-available', output } : part,
				),
			}));
		});
		constructor(readonly init: Record<string, unknown>) {}
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
		turnBody: () => ({ deskLayout: [] }),
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

describe('DeskBotSession client actions', () => {
	type Init = {
		onToolCall(event: { toolCall: { toolCallId: string; toolName: string; input: unknown } }): void;
		sendAutomaticallyWhen(options: { messages: unknown[] }): boolean;
		transport: { prepareSendMessagesRequest(options: Record<string, unknown>): { body: Record<string, unknown> } };
	};
	type MockChat = { init: Init; messages: unknown[]; addToolOutput: ReturnType<typeof vi.fn> };
	const chatOf = (session: InstanceType<typeof DeskBotSession>) => session.chat as unknown as MockChat;
	const callPart = (toolCallId: string, toolName: string, extra: Record<string, unknown> = {}) => ({
		type: `tool-${toolName}`,
		toolCallId,
		state: 'input-available',
		...extra,
	});
	const thread = (...parts: unknown[]) => [
		{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'switch to the budget' }] },
		{ id: 'a1', role: 'assistant', parts: [{ type: 'step-start' }, ...parts] },
	];
	/** Let the session's un-awaited run settle. */
	const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

	async function mounted() {
		const { DESK_FOCUS_PANEL } = await import('#lib/desk/arrange-actions.ts');
		const session = new DeskBotSession();
		const focus = vi.fn(() => ({ status: 'completed' as const, observed: { panel_id: 'p1', front: true } }));
		session.actions.register(DESK_FOCUS_PANEL, focus);
		return { session, chat: chatOf(session), focus };
	}

	it('runs a client-executed call once and answers it with what the handler observed', async () => {
		const { session, chat, focus } = await mounted();
		chat.messages = thread(callPart('call_1', 'desk_focus_panel'));
		const toolCall = { toolCallId: 'call_1', toolName: 'desk_focus_panel', input: { panel_id: 'p1' } };
		chat.init.onToolCall({ toolCall });
		chat.init.onToolCall({ toolCall });
		expect(session.isBusy).toBe(true);
		await settled();

		expect(focus).toHaveBeenCalledTimes(1);
		expect(chat.addToolOutput).toHaveBeenCalledWith({
			tool: 'desk_focus_panel',
			toolCallId: 'call_1',
			output: { status: 'completed', observed: { panel_id: 'p1', front: true } },
		});
		expect(session.isBusy).toBe(false);
		// One continuation for the settled call — asking twice does not send twice.
		expect(chat.init.sendAutomaticallyWhen({ messages: chat.messages })).toBe(true);
		expect(chat.init.sendAutomaticallyWhen({ messages: chat.messages })).toBe(false);
	});

	it('leaves a server tool call alone: it is not this client’s to answer', async () => {
		const { chat, focus } = await mounted();
		chat.init.onToolCall({ toolCall: { toolCallId: 'call_s', toolName: 'desk_list_files', input: {} } });
		await settled();
		expect(focus).not.toHaveBeenCalled();
		expect(chat.addToolOutput).not.toHaveBeenCalled();
	});

	it('does not resend a turn that ended on a server tool — the approval boundary waits for the user', async () => {
		const { chat } = await mounted();
		const waiting = thread(
			callPart('call_r', 'desk_rename_file', { state: 'output-available', output: { requiresApproval: true } }),
		);
		expect(chat.init.sendAutomaticallyWhen({ messages: waiting })).toBe(false);
	});

	it('waits for every call of the step before it continues', async () => {
		const { chat } = await mounted();
		chat.messages = thread(callPart('call_1', 'desk_focus_panel'), callPart('call_2', 'desk_close_panel'));
		chat.init.onToolCall({
			toolCall: { toolCallId: 'call_1', toolName: 'desk_focus_panel', input: { panel_id: 'p1' } },
		});
		await settled();
		// call_2 has no handler mounted and is still waiting for one: the step is not answered yet.
		expect(chat.init.sendAutomaticallyWhen({ messages: chat.messages })).toBe(false);
	});

	it('answers an action nothing is mounted for as unavailable, and still continues so the model can say so', async () => {
		vi.useFakeTimers();
		try {
			const session = new DeskBotSession();
			const chat = chatOf(session);
			chat.messages = thread(callPart('call_1', 'desk_open_file'));
			chat.init.onToolCall({
				toolCall: { toolCallId: 'call_1', toolName: 'desk_open_file', input: { file_id: 'fil_a' } },
			});
			await vi.advanceTimersByTimeAsync(2_000);
			expect(chat.addToolOutput).toHaveBeenCalledWith(
				expect.objectContaining({ output: expect.objectContaining({ status: 'unavailable', code: 'no_handler' }) }),
			);
			expect(chat.init.sendAutomaticallyWhen({ messages: chat.messages })).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});

	it('records a result that settles after Stop, but does not continue the turn', async () => {
		const { DESK_FOCUS_PANEL } = await import('#lib/desk/arrange-actions.ts');
		const session = new DeskBotSession();
		const chat = chatOf(session);
		let finish: (() => void) | undefined;
		session.actions.register(
			DESK_FOCUS_PANEL,
			() =>
				new Promise((resolve) => {
					finish = () => resolve({ status: 'completed' });
				}),
		);
		chat.messages = thread(callPart('call_1', 'desk_focus_panel'));
		chat.init.onToolCall({
			toolCall: { toolCallId: 'call_1', toolName: 'desk_focus_panel', input: { panel_id: 'p1' } },
		});
		await settled();
		session.stop();
		finish?.();
		await settled();
		expect(chat.addToolOutput).toHaveBeenCalledTimes(1);
		expect(chat.init.sendAutomaticallyWhen({ messages: chat.messages })).toBe(false);
	});

	it('drops a result whose thread was replaced by a new chat', async () => {
		const { DESK_FOCUS_PANEL } = await import('#lib/desk/arrange-actions.ts');
		const session = new DeskBotSession();
		const chat = chatOf(session);
		let finish: (() => void) | undefined;
		session.actions.register(
			DESK_FOCUS_PANEL,
			() =>
				new Promise((resolve) => {
					finish = () => resolve({ status: 'completed' });
				}),
		);
		chat.init.onToolCall({
			toolCall: { toolCallId: 'call_1', toolName: 'desk_focus_panel', input: { panel_id: 'p1' } },
		});
		await settled();
		session.newChat();
		finish?.();
		await settled();
		expect(chat.addToolOutput).not.toHaveBeenCalled();
	});

	it('advertises what is mounted at send time, and re-reads the desk for a continuation', async () => {
		const { session, chat } = await mounted();
		const desk = sink();
		desk.turnBody = () => ({ deskLayout: [{ panelId: 'p1', label: 'Budget' }], toolScopes: ['desk:read'] });
		session.attach(desk);
		const prepare = (messages: unknown[], body: Record<string, unknown>) =>
			chat.init.transport.prepareSendMessagesRequest({ body, messages, id: 'c', trigger: 'submit-message' }).body;

		const fresh = prepare([{ id: 'u1', role: 'user', parts: [] }], { deskLayout: [], clientActions: ['forged'] });
		expect(fresh.clientActions).toEqual(['desk_focus_panel']);
		expect(fresh.deskLayout).toEqual([]);

		const continued = prepare(thread(), { deskLayout: [] });
		expect(continued.deskLayout).toEqual([{ panelId: 'p1', label: 'Budget' }]);
		expect(continued.clientActions).toEqual(['desk_focus_panel']);
	});
});

/**
 * "Find my architecture document and open it in the right Desk panel", end to end below the
 * model and the stream: the server tool's result and the client action's call are in the
 * thread as the SDK would leave them, the session runs the call against a REAL dock, and
 * the server's own reader takes the thread the browser would send next. What the three
 * sides hold has to agree — the dock, the thread, and the server's reading of it.
 */
describe('cross-surface turn: a server search, then a client action on the desk', () => {
	it('opens the found file in a right-hand pane and continues with what the browser observed', async () => {
		const { mountArrangeHandlers } = await import('../../arrange-action-handlers');
		const { createDockState } = await import('../../dock.state.svelte');
		const { findLeafWithPanel } = await import('../../dock.operations');
		const { readClientActionResults } = await import('#lib/server/ai/client-action-results.ts');

		const dock = createDockState(
			{ type: 'leaf', id: 'l-bot', tabs: ['bot'], activeTab: 'bot' },
			{ bot: { id: 'bot', type: 'bot', label: 'Desk Bot', closable: true } },
		);
		const session = new DeskBotSession();
		const loadFile = vi.fn(async () => ({ id: 'fil_arch', name: 'Architecture', type: 'markdown' }));
		mountArrangeHandlers(session.actions, { dock, conversationPanelId: 'bot', loadFile });
		const chat = session.chat as unknown as {
			init: {
				onToolCall(event: { toolCall: { toolCallId: string; toolName: string; input: unknown } }): void;
				sendAutomaticallyWhen(options: { messages: unknown[] }): boolean;
			};
			messages: unknown[];
		};

		// Step 1, as streamed: the server already ran the search; the open is the browser's.
		chat.messages = [
			{
				id: 'u1',
				role: 'user',
				parts: [{ type: 'text', text: 'Find my architecture document and open it on the right' }],
			},
			{
				id: 'a1',
				role: 'assistant',
				parts: [
					{ type: 'step-start' },
					{
						type: 'tool-desk_search_files',
						toolCallId: 'call_search',
						state: 'output-available',
						input: { query: 'architecture' },
						output: { files: [{ id: 'fil_arch', name: 'Architecture', type: 'markdown' }] },
					},
					{ type: 'step-start' },
					{
						type: 'tool-desk_open_file',
						toolCallId: 'call_open',
						state: 'input-available',
						input: { file_id: 'fil_arch', placement: 'right' },
					},
				],
			},
		];
		// Dispatched is not done: before the browser acts, nothing is continued or reported.
		expect(chat.init.sendAutomaticallyWhen({ messages: chat.messages })).toBe(false);
		expect(readClientActionResults(chat.messages as never).continuation).toBeNull();

		chat.init.onToolCall({
			toolCall: {
				toolCallId: 'call_open',
				toolName: 'desk_open_file',
				input: { file_id: 'fil_arch', placement: 'right' },
			},
		});
		await new Promise((resolve) => setTimeout(resolve, 0));

		// The desk: the file has its own pane, in front, and the conversation is still showing.
		const filePane = findLeafWithPanel(dock.root, 'markdown-fil_arch');
		expect(filePane?.activeTab).toBe('markdown-fil_arch');
		expect(filePane?.id).not.toBe(findLeafWithPanel(dock.root, 'bot')?.id);
		expect(findLeafWithPanel(dock.root, 'bot')?.activeTab).toBe('bot');
		expect(dock.focusedPanelId).toBe('markdown-fil_arch');

		// The thread goes back once, and the server reads the same thing the desk shows.
		expect(chat.init.sendAutomaticallyWhen({ messages: chat.messages })).toBe(true);
		const reading = readClientActionResults(chat.messages as never);
		expect(reading.continuation).toEqual({
			messageId: 'a1',
			reported: [
				{
					toolCallId: 'call_open',
					toolName: 'desk_open_file',
					input: { file_id: 'fil_arch', placement: 'right' },
					result: {
						status: 'completed',
						observed: {
							panel_id: 'markdown-fil_arch',
							file_id: 'fil_arch',
							panel_type: 'markdown',
							placed: 'split',
							front: true,
						},
					},
				},
			],
		});
		expect(reading.spent).toBe(1);
	});
});
