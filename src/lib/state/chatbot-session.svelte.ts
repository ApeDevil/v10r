/**
 * chatbot-session — client-only module singleton that owns the LIVE "Vely" chat.
 *
 * Why a module singleton (not a context, not component state):
 *   The `@ai-sdk/svelte` `Chat` instance and its in-flight stream must SURVIVE the
 *   chat panel unmounting — on minimize, on within-group navigation, and on the
 *   cross-group `AppShell` remount (AppShell is mounted per route-group). ESM module
 *   caching gives exactly that lifetime: one instance per tab/document, independent
 *   of any component mount. It is deliberately SEPARATE from the mutually-exclusive
 *   `modals` store so a minimized chat coexists with an open quick-search instead of
 *   being evicted.
 *
 * SSR-safety contract (module `$state` is shared per-process on the server):
 *   - the instance holds only inert primitives at construction (`phase='closed'`,
 *     `chat=null`) — no `@ai-sdk/svelte` import at module top level;
 *   - `@ai-sdk/svelte` + `ai` are pulled ONLY via `await import()` inside
 *     `ensureChat()`, which early-returns on the server (`!browser`);
 *   - every mutator is browser-gated, so the server never writes this state and every
 *     SSR render observes the default → no leak, no hydration mismatch.
 *
 * Teardown is named, not assumed: `reset()` is called by `SessionMonitor` on logout /
 * session-expiry (aborts the stream, drops the instance, clears the resume pointer).
 */
import type { Chat } from '@ai-sdk/svelte';
import { untrack } from 'svelte';
import { browser } from '$app/environment';
import { CSRF_HEADER } from '$lib/api';
import type { TurnSummary } from '$lib/types/turn-trace';

export type ChatPhase = 'closed' | 'open' | 'minimized';

/** The message array type the live Chat instance owns (the `@ai-sdk/svelte` copy of
 * `ai` — distinct from the top-level `ai` package, so we derive it from Chat). */
type ChatMessages = Chat['messages'];

/** Per-tab resume pointer; userId-stamped to defend a reused tab against a user switch. */
const STORAGE_KEY = 'v10r:vely';

/** One-shot "reopen Vely after the login round-trip" intent. TTL-guarded so an
 * abandoned sign-in doesn't silently reopen the panel on an unrelated later visit. */
const REOPEN_KEY = 'v10r:vely-reopen';
const REOPEN_TTL_MS = 10 * 60 * 1000;

interface StoredMessage {
	id: string;
	role: string;
	content: string;
	/** The assistant message's parts as streamed (tool parts included); null on older rows. */
	parts?: { type: string }[] | null;
}

/** What `GET /api/ai/conversations/[id]` answers: the rows plus one summary per recorded turn. */
export interface StoredConversation {
	messages: StoredMessage[];
	turns?: TurnSummary[];
}

/**
 * Rehydrate a stored thread into the SDK's message shape. A recorded turn's summary rides on
 * its assistant message as `metadata.trace` — the same key the live stream fills — so the
 * citation chips render on reload exactly as they did live.
 */
function toUiMessages(conversation: StoredConversation): ChatMessages {
	const turns = new Map((conversation.turns ?? []).map((t) => [t.messageId, t]));
	return conversation.messages.map((m) => {
		const turn = turns.get(m.id);
		return {
			id: m.id,
			role: m.role,
			parts: m.parts?.length ? m.parts : [{ type: 'text' as const, text: m.content }],
			...(turn
				? {
						metadata: {
							trace: {
								outcome: turn.outcome,
								activations: turn.activations,
								citations: turn.citations,
								grounding: turn.cited.length ? [{ id: 'catalog', ran: true, items: turn.cited }] : [],
							},
						},
					}
				: {}),
		};
	}) as unknown as ChatMessages;
}

class ChatbotSession {
	/** closed = no live thread · open = visible/focused · minimized = alive, parked. */
	phase = $state<ChatPhase>('closed');
	/** The live AI-SDK chat instance — null until first open (lazy, client-only). */
	chat = $state<Chat | null>(null);
	/** Server thread id, captured from the `X-Conversation-Id` response header. */
	conversationId = $state<string | undefined>(undefined);
	/** A turn finished while the panel was NOT open → light the sidebar indicator. */
	answerReady = $state(false);
	/** Sign-in gate: 'auth_required' when the visitor is known not signed in — set
	 * pre-emptively by `setUser()` and reactively by the transport on a live 401.
	 * Never derived from `chat.error.message`: the SDK stores the raw response body
	 * text there, which carries no status. */
	gate = $state<'ok' | 'auth_required'>('ok');
	/** The last stream error's text (`[kind] message` from the server, or the transport's own),
	 * kept here because the SDK reports a mid-stream `error` frame through `onError` — the
	 * panel reads this before `chat.error`. Cleared by the next send and by a new chat. */
	lastError = $state<string | null>(null);
	/**
	 * A page shows the thread in place of the dock (the chatbot showcase's example): the
	 * dock and the bubble stay out of the way, `open()` readies the thread without docking
	 * it, and a finished answer is read on the page, not flagged unread. A host fact, not a
	 * thread state — `reset()` leaves it alone and the host's release clears it.
	 */
	embedded = $state(false);

	#userId: string | undefined;
	#loadingChat = false;
	#stopWatcher: (() => void) | undefined;

	/** Reactive: is a response currently being produced? (getter, not `$derived`,
	 * to avoid creating a derived signal at module-eval time on the server). */
	get isStreaming(): boolean {
		return this.chat?.status === 'submitted' || this.chat?.status === 'streaming';
	}

	/** AppShell hands us the live session user id (for the resume pointer + guard). */
	setUser(id: string | undefined): void {
		const signedIn = !!id && id !== this.#userId;
		this.#userId = id;
		this.gate = id ? 'ok' : 'auth_required';
		// Login can return via client-side goto (passkey/OTP), so the live instance —
		// and a stale 401 error on it — can survive sign-in; drop it once, on that
		// transition. Untracked: the caller is an `$effect`, and `clearError()` reads
		// `chat.status` — tracked, the effect re-ran on every status change and wiped each
		// turn's error the moment it appeared (the "empty bubble, no error box" defect).
		if (signedIn) {
			untrack(() => {
				this.chat?.clearError();
				this.lastError = null;
			});
		}
	}

	/** Lazily construct the live `Chat` (client-only, idempotent). Pulls the heavy
	 * `@ai-sdk/svelte` + `ai` graph only here, on first open. */
	async ensureChat(): Promise<Chat | null> {
		if (!browser) return null;
		if (this.chat) return this.chat;
		if (this.#loadingChat) return null;
		this.#loadingChat = true;
		try {
			const { Chat, DefaultChatTransport } = await import('./chat-client');
			const chat = new Chat({
				onError: (error) => {
					this.lastError = error.message;
				},
				transport: new DefaultChatTransport({
					api: '/api/ai/chatbot',
					headers: CSRF_HEADER,
					// The server never reads a message's `metadata` — the retrieval trace, citation
					// verdicts and catalog chips it streamed back on earlier turns — yet the default
					// body re-uploads all of it with every turn, ~7 KB per prior turn for the life of
					// the thread. Send each message's identity and parts; the rest of the body is
					// exactly the transport's default.
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
						const response = await fetch(url, init);
						// Typed auth signal: the only place the real status exists — by the
						// time the SDK surfaces the failure, only the body text remains.
						if (response.status === 401) this.gate = 'auth_required';
						const id = response.headers.get('X-Conversation-Id');
						if (id) {
							this.conversationId = id;
							this.#persistPointer();
						}
						return response;
					},
				}) as Chat['transport'],
			});
			this.chat = chat;
			this.#watchStream();
			return chat;
		} finally {
			this.#loadingChat = false;
		}
	}

	/** A page renders the live thread itself. Returns the release the host calls on unmount. */
	attachEmbeddedHost(): () => void {
		this.embedded = true;
		return () => {
			this.embedded = false;
		};
	}

	/**
	 * Open (or restore) the panel; loads the instance and, if resuming, its messages. With an
	 * embedded host on the page the thread is readied in place and the dock stays closed.
	 */
	async open(): Promise<void> {
		if (!browser) return;
		if (!this.embedded) this.phase = 'open';
		this.answerReady = false;
		const chat = await this.ensureChat();
		if (chat) await this.#resumeMessagesIfNeeded(chat);
	}

	/** Park the panel without ending the thread. The stream keeps running. */
	minimize(): void {
		if (!browser) return;
		if (this.phase === 'open') this.phase = 'minimized';
	}

	/** Bring a minimized/closed thread back into view (sidebar trigger / bubble). */
	restore(): void {
		void this.open();
	}

	/** Ctrl+J: closed→open, open→minimized, minimized→open. Never destroys. */
	toggle(): void {
		if (this.phase === 'open' && !this.embedded) this.minimize();
		else void this.open();
	}

	/** The ONLY thread-ending action (× button, or session teardown). */
	close(): void {
		this.reset();
	}

	/** Start a fresh thread but stay open (the in-panel "New chat" + button). */
	async newChat(): Promise<void> {
		const chat = await this.ensureChat();
		this.conversationId = undefined;
		if (chat) chat.messages = [];
		this.answerReady = false;
		this.lastError = null;
		this.#clearPointer();
	}

	/** Send a user turn. Carries `conversationId` (continue) + optional site-awareness
	 *  `pageRouteId` (the caller reads `page.route.id` synchronously at click, so it's
	 *  already frozen to the page the user pressed Send from — immutable for this turn).
	 *  Grounding is implied by the route: `/api/ai/chatbot` sets `surface: 'chatbot'`. */
	async submit(text: string, routeId?: string): Promise<void> {
		if (!browser) return;
		const route = routeId; // frozen by the caller; never re-read across the await below
		const chat = await this.ensureChat();
		// One turn in flight: the composer stays typeable while an answer streams, so the
		// refusal lives here, not in a disabled textarea.
		if (!chat || this.isStreaming) return;
		this.lastError = null;
		const body: Record<string, unknown> = {};
		if (this.conversationId) body.conversationId = this.conversationId;
		if (route) body.pageRouteId = route;
		chat.sendMessage({ text }, { body });
		// A thread started on an embedding page is alive once the visitor leaves it: parked,
		// so the sidebar indicator and the bubble offer it back.
		if (this.embedded && this.phase === 'closed') this.phase = 'minimized';
	}

	/** Abort the in-flight response (the composer's Stop). The tokens received so far stay. */
	stop(): void {
		if (!browser) return;
		void this.chat?.stop();
	}

	/** Adopt an existing conversation from the history list. */
	async adoptConversation(id: string, conversation: StoredConversation): Promise<void> {
		const chat = await this.ensureChat();
		if (!chat) return;
		this.conversationId = id;
		chat.messages = toUiMessages(conversation);
		this.answerReady = false;
		this.#persistPointer();
	}

	/** Cheap, AI-SDK-free: on (re)mount, if this tab had a live thread before reload,
	 * show the minimized indicator. The actual messages load lazily on restore/open. */
	hydratePointer(): void {
		if (!browser || this.chat) return;
		const ptr = this.#readPointer();
		if (!ptr) return;
		if (this.#userId && ptr.userId !== this.#userId) {
			this.#clearPointer();
			return;
		}
		this.conversationId = ptr.conversationId;
		this.phase = 'minimized';
	}

	/** Teardown owner = SessionMonitor on logout/expiry. Aborts the stream cleanly. */
	reset(): void {
		this.phase = 'closed';
		this.answerReady = false;
		// Recompute, never hardcode 'ok': the panel's × button also lands here, and an
		// anonymous visitor who closes and reopens must land back on the gate.
		this.gate = this.#userId ? 'ok' : 'auth_required';
		this.conversationId = undefined;
		this.lastError = null;
		this.chat?.stop?.();
		this.chat = null;
		this.#stopWatcher?.();
		this.#stopWatcher = undefined;
		this.#clearPointer();
	}

	/** Pull a resumed thread's messages from the DB (owner-scoped) — zero model calls.
	 * Singleton-precedence: never clobber a live in-memory thread. */
	async #resumeMessagesIfNeeded(chat: Chat): Promise<void> {
		if (!this.conversationId || chat.messages.length) return;
		try {
			const res = await fetch(`/api/ai/conversations/${this.conversationId}`);
			if (!res.ok) {
				this.#clearPointer();
				this.conversationId = undefined;
				return;
			}
			const { data } = await res.json();
			chat.messages = toUiMessages({ messages: data.messages ?? [], turns: data.turns ?? [] });
		} catch {
			// keep the (empty) live thread; the pointer survives for a later retry
		}
	}

	/** Flag `answerReady` when a stream finishes while the panel isn't open (and no page is
	 * showing the thread). Runs in a standalone effect scope so it works with no component
	 * mounted (cross-group). */
	#watchStream(): void {
		this.#stopWatcher?.();
		this.#stopWatcher = $effect.root(() => {
			let prev: string | undefined;
			$effect(() => {
				const status = this.chat?.status;
				if (prev === 'streaming' && status === 'ready' && this.phase !== 'open' && !this.embedded) {
					this.answerReady = true;
				}
				prev = status;
			});
		});
	}

	/** Remember that the user left for /auth/login mid-visit (gate CTA click or forced
	 * logout with a live panel) so AppShell reopens Vely when they come back. */
	markReopenIntent(): void {
		if (!browser) return;
		try {
			sessionStorage.setItem(REOPEN_KEY, JSON.stringify({ ts: Date.now() }));
		} catch {
			// sessionStorage unavailable — the panel just won't auto-reopen
		}
	}

	/** Read-and-clear the reopen intent. True iff present and younger than the TTL. */
	consumeReopenIntent(): boolean {
		if (!browser) return false;
		try {
			const raw = sessionStorage.getItem(REOPEN_KEY);
			if (!raw) return false;
			sessionStorage.removeItem(REOPEN_KEY);
			const { ts } = JSON.parse(raw) as { ts?: number };
			return typeof ts === 'number' && Date.now() - ts < REOPEN_TTL_MS;
		} catch {
			return false;
		}
	}

	#persistPointer(): void {
		if (!browser || !this.conversationId || !this.#userId) return;
		try {
			sessionStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({ conversationId: this.conversationId, userId: this.#userId }),
			);
		} catch {
			// sessionStorage unavailable (private mode quota) — resume just won't persist
		}
	}

	#clearPointer(): void {
		if (!browser) return;
		try {
			sessionStorage.removeItem(STORAGE_KEY);
		} catch {
			// ignore
		}
	}

	#readPointer(): { conversationId: string; userId: string } | null {
		if (!browser) return null;
		try {
			const raw = sessionStorage.getItem(STORAGE_KEY);
			return raw ? JSON.parse(raw) : null;
		} catch {
			return null;
		}
	}
}

/** The one Vely chat for this tab. Safe to import anywhere — the heavy AI SDK is
 * only loaded when `ensureChat()` runs (first open), never at module top level. */
export const chatbotSession = new ChatbotSession();
