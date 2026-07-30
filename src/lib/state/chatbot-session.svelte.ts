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
import { browser } from '$app/environment';
import { CSRF_HEADER } from '$lib/api';

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
}

function toUiMessages(rows: StoredMessage[]): ChatMessages {
	return rows.map((m) => ({
		id: m.id,
		role: m.role,
		parts: [{ type: 'text' as const, text: m.content }],
	})) as unknown as ChatMessages;
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
		this.#userId = id;
		this.gate = id ? 'ok' : 'auth_required';
		// Login can return via client-side goto (passkey/OTP), so the live instance —
		// and a stale 401 error on it — can survive sign-in; drop it with the gate.
		if (id) this.chat?.clearError();
	}

	/** Lazily construct the live `Chat` (client-only, idempotent). Pulls the heavy
	 * `@ai-sdk/svelte` + `ai` graph only here, on first open. */
	async ensureChat(): Promise<Chat | null> {
		if (!browser) return null;
		if (this.chat) return this.chat;
		if (this.#loadingChat) return null;
		this.#loadingChat = true;
		try {
			const [{ Chat }, { DefaultChatTransport }] = await Promise.all([import('@ai-sdk/svelte'), import('ai')]);
			const chat = new Chat({
				transport: new DefaultChatTransport({
					api: '/api/ai/chatbot',
					headers: CSRF_HEADER,
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

	/** Open (or restore) the panel; loads the instance and, if resuming, its messages. */
	async open(): Promise<void> {
		if (!browser) return;
		this.phase = 'open';
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
		if (this.phase === 'open') this.minimize();
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
		this.#clearPointer();
	}

	/** Send a user turn. Carries `conversationId` (continue) + always-on grounding + optional
	 *  site-awareness `pageRouteId` (the caller reads `page.route.id` synchronously at click, so
	 *  it's already frozen to the page the user pressed Send from — immutable for this turn). */
	async submit(text: string, routeId?: string): Promise<void> {
		if (!browser) return;
		const route = routeId; // frozen by the caller; never re-read across the await below
		const chat = await this.ensureChat();
		if (!chat) return;
		const body: Record<string, unknown> = { useLlmwiki: true };
		if (this.conversationId) body.conversationId = this.conversationId;
		if (route) body.pageRouteId = route;
		chat.sendMessage({ text }, { body });
	}

	/** Adopt an existing conversation from the history list. */
	async adoptConversation(id: string, rows: StoredMessage[]): Promise<void> {
		const chat = await this.ensureChat();
		if (!chat) return;
		this.conversationId = id;
		chat.messages = toUiMessages(rows);
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
			chat.messages = toUiMessages(data.messages ?? []);
		} catch {
			// keep the (empty) live thread; the pointer survives for a later retry
		}
	}

	/** Flag `answerReady` when a stream finishes while the panel isn't open. Runs in a
	 * standalone effect scope so it works with no component mounted (cross-group). */
	#watchStream(): void {
		this.#stopWatcher?.();
		this.#stopWatcher = $effect.root(() => {
			let prev: string | undefined;
			$effect(() => {
				const status = this.chat?.status;
				if (prev === 'streaming' && status === 'ready' && this.phase !== 'open') {
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
