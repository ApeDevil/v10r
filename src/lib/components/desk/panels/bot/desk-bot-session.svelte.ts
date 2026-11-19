/**
 * desk-bot-session — owns the LIVE Desk Bot conversation of one bot panel.
 *
 * Like `spreadsheet-session.svelte.ts`, the session outlives the panel component: a
 * layout move remounts `ChatPanel`, and the `Chat` instance, its in-flight stream, the
 * conversation id, every proposal's run state and the set of tool calls whose desk
 * effects were already dispatched all have to survive that — a remount that replayed a
 * cached "created file" effect opened the file a second time. Keyed by user, workspace
 * and panel so a user switch structurally never sees another user's thread; torn down
 * by `resetDeskBotSessions()` (`desk-bot-session-registry.ts`) from `SessionMonitor` on
 * logout, beside the chatbot's.
 *
 * Effects need the dock and the bus, which are component context. The mounted panel
 * `attach()`es a sink; effects that arrive while no panel is attached (mid-move) wait
 * and flush on the next `attach()`.
 *
 * Approval is a run, not a request: `approve()` moves the proposal's run through
 * `approving` to the status the server reports, dispatches the effects of the steps that
 * completed even when the plan failed, and puts the server's receipt message into the
 * thread — which is how the model learns what ran, with no acknowledgement turn.
 * A lost response is `unknown` until `GET /api/ai/proposals/[id]` settles it.
 *
 * Client actions run here too (`#lib/client-actions/`). The session owns the runner — its
 * dedup has to outlive a remount, like the effects' — and the mounted panel lends it the
 * handlers. A call for a client-executed tool is run once, its result is written into the
 * thread as that call's output, and only a result settled live in this session sends the
 * continuation request; nothing is continued for a call the browser did not just run.
 */

import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { apiFetch, CSRF_HEADER } from '#lib/api.ts';
import type { ClientActionResult } from '#lib/client-actions/contract.ts';
import { type ClientActionRunner, createClientActionRunner } from '#lib/client-actions/runner.ts';
import {
	isClientExecutedTool,
	isToolPart,
	toolNameOf,
	toolPartFailed,
} from '#lib/components/composites/chatbot/tool-part.ts';
import { DESK_ARRANGE_ACTIONS } from '#lib/desk/arrange-actions.ts';
import { Chat, DefaultChatTransport } from '#lib/state/chat-client.ts';
import { liveDeskBotSession, sessionKey } from '#lib/state/desk-bot-session-registry.ts';
import { parseAiErrorKind } from '#lib/types/ai-error.ts';
import type { ProposalOutcome, ProposalRun, ProposalRunPhase } from '#lib/types/ai-proposal.ts';
import type { DeskEffect } from '#lib/types/ai-tools.ts';
import { appendIOLog } from '../../io-log.state.svelte';

export interface FileRefreshed {
	fileId: string;
	version: number | null;
	ok: boolean;
}

/** What the mounted panel lends the session: the dock and bus it does not own. */
export interface DeskBotSink {
	dispatchEffect(effect: DeskEffect): void;
	/** Resolves when the panel showing `fileId` reports its reload, or null on timeout. */
	awaitFileRefreshed(fileId: string): Promise<FileRefreshed | null>;
	/**
	 * What a turn tells the server about the desk as it is NOW — scopes, open panels, their
	 * context. A continuation after a client action sends it afresh, so the model reads the
	 * workspace the action left behind rather than the one the user's message was sent from.
	 */
	turnBody(): Record<string, unknown>;
}

/**
 * How long a client action waits for its handler when the panel is mid-remount (a layout
 * move unmounts and remounts it within a frame) before it is reported unavailable.
 */
const HANDLER_WAIT_MS = 1_500;

/**
 * Failure kinds beyond the server's classified `AiErrorKind`s: the visitor session is
 * gone (401 from the auth guard, before any AI code), or the conversation quota refused
 * the turn. Each is set from a status or header, never from prose.
 */
type DeskBotErrorKind = string;

const PENDING_RUN: ProposalRun = { phase: 'pending', steps: [], failureMessage: null, revert: null };

const TERMINAL_PHASES: ReadonlySet<ProposalRunPhase> = new Set(['executed', 'failed', 'rejected', 'expired']);

export class DeskBotSession {
	readonly chat: Chat;
	conversationId = $state<string | undefined>(undefined);
	lastErrorKind = $state<DeskBotErrorKind | null>(null);
	/** Per proposal: where its approval stands. Absent = still pending on the card. */
	readonly runs = new SvelteMap<string, ProposalRun>();
	/**
	 * Undo requests THIS client has in flight. Busy-ness comes from here, not from a
	 * `reverting` the server reported: a revert whose process died is healed by the status
	 * route, and must never hold the session busy in the meantime.
	 */
	readonly #reverting = new SvelteSet<string>();
	/**
	 * The client actions of this conversation. Session-owned so a call is run once whatever
	 * remounts in between; the mounted panel registers the handlers (`mountArrangeHandlers`).
	 */
	readonly actions: ClientActionRunner = createClientActionRunner(DESK_ARRANGE_ACTIONS, {
		handlerWaitMs: HANDLER_WAIT_MS,
	});
	/** Client actions in flight — a turn is not over while the browser is still acting on it. */
	#acting = $state(0);
	/** Calls settled live in this session whose continuation request has not been sent yet. */
	#unsent = new Set<string>();
	/** Bumped by every submit, Stop and new chat: a result that settles later is not continued. */
	#turn = 0;

	/** Bumped by `newChat()`: a response header from the previous thread must not name this one. */
	#epoch = 0;
	#dispatched = new Set<string>();
	#sink: DeskBotSink | null = null;
	#pendingEffects: DeskEffect[] = [];
	#stopWatcher: (() => void) | undefined;

	constructor() {
		this.chat = new Chat({
			transport: new DefaultChatTransport({
				api: '/api/ai/deskbot',
				headers: CSRF_HEADER,
				// The server never reads a message's `metadata` (the proposal card, the pipeline
				// trace); re-uploading it every turn only grows the request. Identity and parts.
				prepareSendMessagesRequest: ({ body, messages, id, trigger, messageId }) => ({
					body: {
						...body,
						// A request whose last message is the assistant's continues it after client
						// actions: it describes the desk those actions left, not the one the user's
						// message was sent from.
						...(messages[messages.length - 1]?.role === 'assistant' ? this.#sink?.turnBody() : {}),
						// Read at send time, from the runner itself: only what has a handler mounted
						// right now is advertised, so the server never offers an action nothing can run.
						clientActions: this.actions.available(),
						id,
						trigger,
						messageId,
						messages: messages.map(({ metadata: _metadata, ...message }) => message),
					},
				}),
				fetch: async (url, init) => {
					const sentIn = this.#epoch;
					const response = await fetch(url, init);
					// Session-expiry 401s and the guard's own 429s (this user's rate limit or daily
					// budget) come from BEFORE the orchestrator — they never carry X-AI-Error-Kind, so
					// classify on status here. A provider's 429 does carry the header (`rate_limit`),
					// and the header wins: only one of the two limits is the user's doing.
					if (response.status === 401) this.#fail('unauthorized');
					const errorKind =
						response.headers.get('X-AI-Error-Kind') ?? (response.status === 429 ? 'rate_limited' : null);
					if (errorKind) this.#fail(errorKind);
					const id = response.headers.get('X-Conversation-Id');
					if (id && sentIn === this.#epoch) this.conversationId = id;
					return response;
				},
			}) as Chat['transport'],
			onError: (error) => {
				// Stream errors bypass the response headers: the frame text is `[kind] message`.
				if (!this.lastErrorKind) this.#fail(parseAiErrorKind(error.message ?? '') ?? 'unknown');
			},
			// Fires for every tool call in the stream; only a client-executed tool is this
			// client's to answer. Not awaited: the SDK processes the stream on the same queue
			// `addToolOutput` writes through, so awaiting here would wait on itself.
			onToolCall: ({ toolCall }) => {
				if (isClientExecutedTool(toolCall.toolName)) void this.#runClientAction(toolCall);
			},
			sendAutomaticallyWhen: ({ messages }) => this.#continues(messages),
		});
		this.#watchToolParts();
	}

	get isStreaming(): boolean {
		return this.chat.status === 'submitted' || this.chat.status === 'streaming';
	}

	/** An approval request is in flight — nothing else may start until it settles. */
	get isApproving(): boolean {
		if (this.#reverting.size > 0) return true;
		for (const run of this.runs.values()) if (run.phase === 'approving') return true;
		return false;
	}

	/** Typing is always allowed; this is what Send, Approve, Reject and New chat wait for. */
	get isBusy(): boolean {
		return this.isStreaming || this.isApproving || this.isActing;
	}

	/** A client action is running: the turn it belongs to has not answered yet. */
	get isActing(): boolean {
		return this.#acting > 0;
	}

	runFor(proposalId: string): ProposalRun {
		return this.runs.get(proposalId) ?? PENDING_RUN;
	}

	attach(sink: DeskBotSink): void {
		this.#sink = sink;
		const queued = this.#pendingEffects;
		this.#pendingEffects = [];
		for (const effect of queued) sink.dispatchEffect(effect);
		// A panel that remounts mid-approval, or after a lost response, asks the server.
		for (const [id, run] of this.runs) {
			const revertOpen = run.revert?.phase === 'reverting' || run.revert?.phase === 'unknown';
			if (run.phase === 'approving' || run.phase === 'unknown' || revertOpen) void this.reconcile(id);
		}
	}

	detach(sink: DeskBotSink): void {
		if (this.#sink === sink) this.#sink = null;
	}

	submit(text: string, body: Record<string, unknown>): void {
		if (this.isBusy) return;
		this.lastErrorKind = null;
		this.#turn += 1;
		this.chat.sendMessage({ text }, { body });
	}

	/** Abort the in-flight response. Whatever a tool already did stays done. */
	stop(): void {
		// A client action still running settles into the thread, but starts no new request.
		this.#turn += 1;
		this.#unsent.clear();
		void this.chat.stop();
		appendIOLog({ source: 'progress', label: 'Stopped — completed actions remain.' });
	}

	newChat(): void {
		if (this.isApproving) return;
		void this.chat.stop();
		this.#epoch += 1;
		this.#turn += 1;
		this.#unsent.clear();
		this.conversationId = undefined;
		this.chat.messages = [];
		this.runs.clear();
		this.lastErrorKind = null;
		this.#pendingEffects = [];
	}

	async approve(proposalId: string): Promise<void> {
		if (this.isBusy) return;
		this.runs.set(proposalId, { phase: 'approving', steps: [], failureMessage: null, revert: null });
		try {
			const res = await apiFetch(`/api/ai/proposals/${proposalId}/approve`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{}',
			});
			if (res.ok) {
				const { data } = (await res.json()) as { data: ProposalOutcome };
				this.#settle(data);
				return;
			}
			// A 409 names a state the server already reached (in flight, expired, failed…); any
			// other refusal leaves the truth on the server too. Read it rather than guess.
			appendIOLog({ source: 'effect', level: 'error', label: `Plan approval refused: ${res.status}` });
			await this.reconcile(proposalId);
		} catch (err) {
			// The request may have reached the server — the outcome is unknown, not failed.
			this.runs.set(proposalId, { phase: 'unknown', steps: [], failureMessage: null, revert: null });
			appendIOLog({
				source: 'effect',
				level: 'error',
				label: 'Plan approval: no response — checking status.',
				detail: err instanceof Error ? err.message : String(err),
			});
			await this.reconcile(proposalId);
		}
	}

	async reject(proposalId: string): Promise<void> {
		if (this.isBusy) return;
		this.runs.set(proposalId, { phase: 'approving', steps: [], failureMessage: null, revert: null });
		try {
			const res = await apiFetch(`/api/ai/proposals/${proposalId}/approve`, { method: 'DELETE' });
			if (res.ok) {
				this.runs.set(proposalId, { phase: 'rejected', steps: [], failureMessage: null, revert: null });
				appendIOLog({ source: 'effect', label: 'Plan rejected.' });
				return;
			}
			await this.reconcile(proposalId);
		} catch {
			this.runs.set(proposalId, { phase: 'unknown', steps: [], failureMessage: null, revert: null });
			await this.reconcile(proposalId);
		}
	}

	/**
	 * Undo a plan that ran. Same shape as `approve()`: the run's revert goes `reverting` →
	 * the status the server reports, a lost response is `unknown` until `reconcile()` reads
	 * it, and the server's revert message joins the thread so the model learns what was undone.
	 */
	async revert(proposalId: string): Promise<void> {
		const run = this.runs.get(proposalId);
		if (this.isBusy || !run || run.revert) return;
		this.runs.set(proposalId, { ...run, revert: { phase: 'reverting', steps: [] } });
		this.#reverting.add(proposalId);
		try {
			const res = await apiFetch(`/api/ai/proposals/${proposalId}/revert`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{}',
			});
			if (res.ok) {
				const { data } = (await res.json()) as { data: ProposalOutcome };
				this.#settle(data);
				return;
			}
			appendIOLog({ source: 'effect', level: 'error', label: `Undo refused: ${res.status}` });
			// Nothing was claimed for this request; the status route says what, if anything, was.
			this.runs.set(proposalId, { ...run, revert: null });
			await this.reconcile(proposalId);
		} catch (err) {
			this.runs.set(proposalId, { ...run, revert: { phase: 'unknown', steps: [] } });
			appendIOLog({
				source: 'effect',
				level: 'error',
				label: 'Undo: no response — checking status.',
				detail: err instanceof Error ? err.message : String(err),
			});
			await this.reconcile(proposalId);
		} finally {
			this.#reverting.delete(proposalId);
		}
	}

	/** Ask the server where a proposal stands; the one path out of `unknown`. */
	async reconcile(proposalId: string): Promise<void> {
		try {
			const res = await apiFetch(`/api/ai/proposals/${proposalId}`);
			if (!res.ok) {
				this.#markUnknown(proposalId);
				return;
			}
			const { data } = (await res.json()) as { data: ProposalOutcome };
			this.#settle(data);
		} catch {
			this.#markUnknown(proposalId);
		}
	}

	/**
	 * An unreadable status. A run whose UNDO was in question keeps its receipts — only the
	 * undo is unknown; anything else is unknown as a whole until the next reconcile.
	 */
	#markUnknown(proposalId: string): void {
		const run = this.runs.get(proposalId);
		if (run?.revert) {
			this.runs.set(proposalId, { ...run, revert: { ...run.revert, phase: 'unknown' } });
			return;
		}
		this.runs.set(proposalId, { phase: 'unknown', steps: [], failureMessage: null, revert: null });
	}

	/** Teardown owner = `resetDeskBotSessions` on logout. */
	destroy(): void {
		void this.chat.stop();
		this.#stopWatcher?.();
		this.#stopWatcher = undefined;
		this.#sink = null;
		this.#pendingEffects = [];
	}

	/**
	 * Run one client action and write its result into the thread as the call's output. The
	 * runner answers every way a call can go — unknown, invalid, unavailable, timed out,
	 * failed — so there is always a result, and it is always the browser's own observation.
	 */
	async #runClientAction(call: { toolCallId: string; toolName: string; input: unknown }): Promise<void> {
		const { toolCallId, toolName } = call;
		const epoch = this.#epoch;
		const turn = this.#turn;
		this.#acting += 1;
		let result: ClientActionResult;
		try {
			result = await this.actions.run({ callId: toolCallId, name: toolName, input: call.input });
		} finally {
			this.#acting -= 1;
		}
		// A new chat started while the browser was acting: there is no thread to answer in.
		if (epoch !== this.#epoch) return;
		appendIOLog({
			source: 'effect',
			toolName,
			level: result.status === 'completed' ? 'success' : 'error',
			label: `${toolName}: ${result.status}${result.code ? ` (${result.code})` : ''}`,
			...(result.message ? { detail: result.message } : {}),
		});
		// Stopped, or a newer turn began: the result is recorded, the request is not continued.
		if (turn === this.#turn) this.#unsent.add(toolCallId);
		const addToolOutput = this.chat.addToolOutput as (output: {
			tool: string;
			toolCallId: string;
			output: unknown;
		}) => Promise<void>;
		await addToolOutput({ tool: toolName, toolCallId, output: result });
	}

	/**
	 * Whether the thread should go back to the server on its own. Only when the assistant's
	 * last step holds a client action this session just settled, and nothing in that step is
	 * still unanswered. The SDK's stock predicate would also fire on a step that ended on a
	 * SERVER tool — the approval boundary is exactly that — and resend a turn that is waiting
	 * for the user's decision.
	 */
	#continues(messages: readonly { role: string; parts?: readonly { type: string }[] }[]): boolean {
		const last = messages[messages.length - 1];
		if (!last || last.role !== 'assistant' || !last.parts) return false;
		const stepStart = last.parts.map((p) => p.type).lastIndexOf('step-start');
		const step = last.parts.slice(stepStart + 1).filter(isToolPart);
		if (step.some((part) => part.state !== 'output-available' && part.state !== 'output-error')) return false;
		const mine = step.filter((part) => this.#unsent.has(part.toolCallId));
		if (mine.length === 0) return false;
		for (const part of mine) this.#unsent.delete(part.toolCallId);
		return true;
	}

	#fail(kind: DeskBotErrorKind): void {
		this.lastErrorKind = kind;
		appendIOLog({ source: 'effect', level: 'error', label: 'AI error', detail: kind });
	}

	#settle(outcome: ProposalOutcome): void {
		const previous = this.runs.get(outcome.id);
		// A settled run never regresses: a status read that left the server before the approval
		// finished may arrive after the approval's own answer did.
		if (previous && TERMINAL_PHASES.has(previous.phase) && !TERMINAL_PHASES.has(outcome.status)) return;
		// A settled undo is never erased by a status read that left the server before the undo
		// was claimed. An undo still in question with no server record was never claimed.
		const settledBefore =
			previous?.revert && (previous.revert.phase === 'reverted' || previous.revert.phase === 'revert_failed')
				? previous.revert
				: null;
		const revert = outcome.revert ? { phase: outcome.revert.status, steps: outcome.revert.steps } : settledBefore;
		this.runs.set(outcome.id, {
			phase: outcome.status,
			steps: outcome.steps,
			failureMessage: outcome.failureMessage,
			revert,
		});
		// The undo settles once, like the run: its effects and message on the first terminal answer.
		if (revert && revert.phase !== 'reverting' && previous?.phase === outcome.status) {
			if (previous.revert?.phase === revert.phase) return;
			const undone = revert.steps.filter((step) => step.kind === 'ok').length;
			appendIOLog({
				source: 'effect',
				level: revert.phase === 'reverted' ? 'success' : 'error',
				label: `Undo: ${undone} of ${revert.steps.length} step${revert.steps.length === 1 ? '' : 's'} undone.`,
			});
			for (const effect of outcome.effects) this.#dispatch(effect);
			if (outcome.receiptMessage) this.#appendReceipt(outcome.receiptMessage.id, outcome.receiptMessage.text);
			return;
		}
		// Effects are dispatched once per settle from the client's side: a reconcile after a
		// lost response has to refresh the desk, a reconcile of a run already settled must not.
		if (previous?.phase === outcome.status) return;
		if (outcome.status === 'executed' || outcome.status === 'failed') {
			const done = outcome.steps.filter((s) => s.kind === 'ok').length;
			appendIOLog({
				source: 'effect',
				level: outcome.status === 'executed' ? 'success' : 'error',
				label:
					outcome.status === 'executed'
						? `Plan executed (${done} step${done === 1 ? '' : 's'}).`
						: `Plan stopped after ${done} step${done === 1 ? '' : 's'}: ${outcome.failureMessage ?? 'failed'}`,
			});
			for (const effect of outcome.effects) this.#dispatch(effect);
			if (outcome.receiptMessage) this.#appendReceipt(outcome.receiptMessage.id, outcome.receiptMessage.text);
		}
	}

	/** The server's deterministic account of the run joins the thread as an assistant message. */
	#appendReceipt(id: string, text: string): void {
		if (this.chat.messages.some((m) => m.id === id)) return;
		this.chat.messages = [
			...this.chat.messages,
			{ id, role: 'assistant', parts: [{ type: 'text', text }] } as Chat['messages'][number],
		];
	}

	#dispatch(effect: DeskEffect): void {
		if (!this.#sink) {
			this.#pendingEffects.push(effect);
			return;
		}
		this.#sink.dispatchEffect(effect);
		if (effect.type === 'desk:refresh_file') void this.#confirmRefresh(effect.fileId);
	}

	/** A published refresh is a request; the panel's reply is the fact the log records. */
	async #confirmRefresh(fileId: string): Promise<void> {
		const refreshed = await this.#sink?.awaitFileRefreshed(fileId);
		if (refreshed?.ok) {
			appendIOLog({
				source: 'effect',
				level: 'success',
				label: refreshed.version === null ? 'File reloaded.' : `File reloaded at version ${refreshed.version}.`,
			});
		} else {
			appendIOLog({
				source: 'effect',
				level: 'error',
				label: refreshed ? 'File reload failed — reopen the file.' : 'Reload not confirmed — no open panel answered.',
			});
		}
	}

	/**
	 * Watch the assistant message for tool parts — `tool-<name>` (or `dynamic-tool`) with
	 * the SDK's `state` — log each call as it starts (`input-available`) and settles
	 * (`output-available` / `output-error`), and dispatch the DeskEffects a settled tool
	 * returned. Lives here, not in the component: the dedup set has to outlive a remount.
	 */
	#watchToolParts(): void {
		this.#stopWatcher = $effect.root(() => {
			$effect(() => {
				const messages = this.chat.messages;
				const lastMsg = messages[messages.length - 1];
				if (!lastMsg || lastMsg.role !== 'assistant' || !lastMsg.parts) return;
				for (const raw of lastMsg.parts) {
					// Widen first: narrowing the SDK's own part union through the predicate yields an
					// intersection whose `output` is `never` on some members.
					const part: { type: string } = raw;
					if (!isToolPart(part)) continue;
					const key = `${part.toolCallId}-${part.state}`;
					if (this.#dispatched.has(key)) continue;
					this.#dispatched.add(key);
					const toolName = toolNameOf(part);
					if (part.state === 'input-available') {
						appendIOLog({ source: 'tool-call', toolName, label: `Calling ${toolName}...` });
					} else if (part.state === 'output-available' || part.state === 'output-error') {
						const failed = toolPartFailed(part);
						appendIOLog({
							source: 'tool-result',
							toolName,
							label: failed ? `${toolName} failed` : `${toolName} completed`,
							level: failed ? 'error' : 'success',
						});
						for (const effect of part.output?.effects ?? []) this.#dispatch(effect);
					}
				}
			});
		});
	}
}

// Populated only on mount, never on the server. Reopening a panel reuses its live thread.
export function getDeskBotSession(userId: string, workspaceId: string, panelId: string): DeskBotSession {
	return liveDeskBotSession(sessionKey(userId, workspaceId, panelId), () => new DeskBotSession());
}
