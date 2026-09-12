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
 */

import { SvelteMap } from 'svelte/reactivity';
import { apiFetch, CSRF_HEADER } from '$lib/api';
import { isToolPart, toolNameOf } from '$lib/components/composites/chatbot/tool-part';
import { Chat, DefaultChatTransport } from '$lib/state/chat-client';
import { liveDeskBotSession, sessionKey } from '$lib/state/desk-bot-session-registry';
import { parseAiErrorKind } from '$lib/types/ai-error';
import type { ProposalOutcome, ProposalRun, ProposalRunPhase } from '$lib/types/ai-proposal';
import type { DeskEffect } from '$lib/types/ai-tools';
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
}

/**
 * Failure kinds beyond the server's classified `AiErrorKind`s: the visitor session is
 * gone (401 from the auth guard, before any AI code), or the conversation quota refused
 * the turn. Each is set from a status or header, never from prose.
 */
type DeskBotErrorKind = string;

const PENDING_RUN: ProposalRun = { phase: 'pending', steps: [], failureMessage: null };

const TERMINAL_PHASES: ReadonlySet<ProposalRunPhase> = new Set(['executed', 'failed', 'rejected', 'expired']);

export class DeskBotSession {
	readonly chat: Chat;
	conversationId = $state<string | undefined>(undefined);
	lastErrorKind = $state<DeskBotErrorKind | null>(null);
	/** Per proposal: where its approval stands. Absent = still pending on the card. */
	readonly runs = new SvelteMap<string, ProposalRun>();

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
		});
		this.#watchToolParts();
	}

	get isStreaming(): boolean {
		return this.chat.status === 'submitted' || this.chat.status === 'streaming';
	}

	/** An approval request is in flight — nothing else may start until it settles. */
	get isApproving(): boolean {
		for (const run of this.runs.values()) if (run.phase === 'approving') return true;
		return false;
	}

	/** Typing is always allowed; this is what Send, Approve, Reject and New chat wait for. */
	get isBusy(): boolean {
		return this.isStreaming || this.isApproving;
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
			if (run.phase === 'approving' || run.phase === 'unknown') void this.reconcile(id);
		}
	}

	detach(sink: DeskBotSink): void {
		if (this.#sink === sink) this.#sink = null;
	}

	submit(text: string, body: Record<string, unknown>): void {
		if (this.isBusy) return;
		this.lastErrorKind = null;
		this.chat.sendMessage({ text }, { body });
	}

	/** Abort the in-flight response. Whatever a tool already did stays done. */
	stop(): void {
		void this.chat.stop();
		appendIOLog({ source: 'progress', label: 'Stopped — completed actions remain.' });
	}

	newChat(): void {
		if (this.isApproving) return;
		void this.chat.stop();
		this.#epoch += 1;
		this.conversationId = undefined;
		this.chat.messages = [];
		this.runs.clear();
		this.lastErrorKind = null;
		this.#pendingEffects = [];
	}

	async approve(proposalId: string): Promise<void> {
		if (this.isBusy) return;
		this.runs.set(proposalId, { phase: 'approving', steps: [], failureMessage: null });
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
			this.runs.set(proposalId, { phase: 'unknown', steps: [], failureMessage: null });
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
		this.runs.set(proposalId, { phase: 'approving', steps: [], failureMessage: null });
		try {
			const res = await apiFetch(`/api/ai/proposals/${proposalId}/approve`, { method: 'DELETE' });
			if (res.ok) {
				this.runs.set(proposalId, { phase: 'rejected', steps: [], failureMessage: null });
				appendIOLog({ source: 'effect', label: 'Plan rejected.' });
				return;
			}
			await this.reconcile(proposalId);
		} catch {
			this.runs.set(proposalId, { phase: 'unknown', steps: [], failureMessage: null });
			await this.reconcile(proposalId);
		}
	}

	/** Ask the server where a proposal stands; the one path out of `unknown`. */
	async reconcile(proposalId: string): Promise<void> {
		try {
			const res = await apiFetch(`/api/ai/proposals/${proposalId}`);
			if (!res.ok) {
				this.runs.set(proposalId, { phase: 'unknown', steps: [], failureMessage: null });
				return;
			}
			const { data } = (await res.json()) as { data: ProposalOutcome };
			this.#settle(data);
		} catch {
			this.runs.set(proposalId, { phase: 'unknown', steps: [], failureMessage: null });
		}
	}

	/** Teardown owner = `resetDeskBotSessions` on logout. */
	destroy(): void {
		void this.chat.stop();
		this.#stopWatcher?.();
		this.#stopWatcher = undefined;
		this.#sink = null;
		this.#pendingEffects = [];
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
		this.runs.set(outcome.id, { phase: outcome.status, steps: outcome.steps, failureMessage: outcome.failureMessage });
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
						const failed = part.state === 'output-error' || !!part.output?.error;
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
