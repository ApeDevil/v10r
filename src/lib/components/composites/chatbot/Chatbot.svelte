<script lang="ts">
import { MediaQuery } from 'svelte/reactivity';
import { page } from '$app/state';
import { apiFetch } from '$lib/api';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { isSiteAwareRoute, resolveRouteLabel } from '$lib/search/route-id';
import { chatbotSession } from '$lib/state/chatbot-session.svelte';
import { layerStack } from '$lib/state/layer-stack.svelte';
import { useSurface } from '$lib/styles/elevation';
import { cn } from '$lib/utils/cn';
import ChatInput from './ChatInput.svelte';
import ChatThread from './ChatThread.svelte';

interface Conversation {
	id: string;
	title: string;
	updatedAt: string;
}

// The live thread lives in the module singleton (survives minimize + cross-group
// AppShell remount). This component is the DOCK around it — header, history, composer;
// the conversation itself is `ChatThread`, shared with the chatbot showcase's example.
const session = chatbotSession;

// Relative elevation — the docked assistant panel sits one rung above the page plane.
const s = useSurface();

let conversations: Conversation[] = $state([]);
let conversationsError = $state(false);
let showSidebar = $state(false);
let pendingDeleteId: string | null = $state(null);
let inputValue = $state('');

let panelEl: HTMLElement | undefined = $state();
const isDesktop = new MediaQuery('(min-width: 768px)', true);

const isLoading = $derived(session.isStreaming);

// Site-awareness disclosure: the human label of the page Vely is currently aware of.
// Null on private/unknown routes → the chip hides (the honest "not reading this page" signal).
// Live present-tense: reflects the CURRENT route, so it reads as the antecedent of "this".
const pageLabel = $derived(resolveRouteLabel(page.route.id));

// Sign-in gate — sourced from the singleton (set pre-emptively by AppShell's setUser
// and reactively by the transport on a live 401), NEVER from getSession(): the context
// copy in this subtree is frozen at mount and no auth transition updates it here.
const gated = $derived(session.gate === 'auth_required');
// Query appended AFTER localizeHref (SessionMonitor's shape); the login server load
// sanitizes returnTo and re-localizes it idempotently.
const loginHref = $derived(
	`${localizeHref('/auth/login')}?returnTo=${encodeURIComponent(page.url.pathname + page.url.search)}`,
);

// Load the history list when the panel opens. Gated: the sign-in gate's
// contract is that the failing request never fires — an anonymous visitor
// opening the panel must not emit a known-401 to /api/ai/conversations.
$effect(() => {
	if (session.phase === 'open' && !gated) loadConversations();
});

// Refresh history once a brand-new conversation gets persisted (first turn).
$effect(() => {
	if (session.chat?.status === 'ready' && !session.conversationId && (session.chat?.messages.length ?? 0) > 0) {
		loadConversations();
	}
});

// The mobile bottom sheet behaves modally (covers the page) — register it as a
// dismissal layer. The desktop dock is a persistent workspace panel and never registers.
$effect(() => {
	if (session.phase === 'open' && !isDesktop.current) {
		layerStack.push('chatbot-sheet');
		return () => layerStack.pop('chatbot-sheet');
	}
});

// Esc minimizes (never destroys) when focus is inside the open panel.
function onWindowKeydown(e: KeyboardEvent) {
	if (e.key !== 'Escape') return;
	if (session.phase !== 'open' || !panelEl?.contains(document.activeElement)) return;
	// The mobile sheet is a registered dismissal layer — yield to anything stacked above.
	if (!isDesktop.current && !layerStack.wasTop('chatbot-sheet')) return;
	session.minimize();
}

async function loadConversations() {
	conversationsError = false;
	try {
		const res = await fetch('/api/ai/conversations');
		if (res.ok) {
			const json = await res.json();
			conversations = json.data.items;
		} else {
			conversationsError = true;
		}
	} catch {
		conversationsError = true;
	}
}

async function loadConversation(conv: Conversation) {
	try {
		const res = await fetch(`/api/ai/conversations/${conv.id}`);
		if (!res.ok) return;
		const { data } = await res.json();
		await session.adoptConversation(conv.id, data);
		showSidebar = false;
	} catch {
		// silently fail
	}
}

async function deleteConversation(id: string) {
	try {
		const res = await apiFetch(`/api/ai/conversations/${id}`, { method: 'DELETE' });
		if (res.ok) {
			conversations = conversations.filter((c) => c.id !== id);
			if (session.conversationId === id) session.newChat();
		}
	} catch {
		// silently fail
	} finally {
		pendingDeleteId = null;
	}
}

function submitMessage() {
	if (gated || !inputValue.trim() || isLoading) return;
	const text = inputValue;
	inputValue = '';
	// Capture the route SYNCHRONOUSLY at click → frozen to the page Send was pressed from.
	// Private/unknown routes send nothing (server membership check is the authoritative gate).
	const routeId = page.route.id;
	session.submit(text, isSiteAwareRoute(routeId) ? (routeId ?? undefined) : undefined);
}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<aside
	bind:this={panelEl}
	role="complementary"
	aria-label="Vely assistant"
	{...s.attrs}
	class={cn(
		'fixed z-panel text-fg',
		// mobile: bottom sheet
		'inset-x-2 bottom-0 max-h-[85svh] rounded-t-lg border',
		'pb-[max(env(safe-area-inset-bottom),12px)]',
		// desktop: full-height right-docked column (content reflows via main's md:pr)
		'md:inset-x-auto md:top-0 md:right-0 md:bottom-0 md:h-[100dvh] md:w-[28rem]',
		'md:max-w-[calc(100vw-var(--sidebar-rail-width))] md:rounded-none md:border-0 md:border-l md:pb-0',
		// Display is mutually exclusive so `flex` can never override `hidden` (minimize).
		session.phase === 'open' ? 'flex flex-col' : 'hidden'
	)}
>
	<!-- Header.
	     The "AI assistant" wording is the PERSISTENT half of the AI Act Art. 50(1)
	     disclosure — it stays visible for resumed conversations, where the empty
	     state below never renders. Real text, not a badge image, because Art. 50(5)
	     requires the disclosure to meet accessibility requirements. Do not shorten
	     it to a bot icon: the Commission's Art. 50 Guidelines (20 Jul 2026) name
	     fleeting or purely visual indicators as insufficient. -->
	<div class="flex items-center justify-between border-b border-border px-4 py-3">
		<p class="text-fluid-base text-fg">
			<span class="font-semibold">Vely</span> <span class="font-light text-muted">{m.ai_disclosure_badge()}</span>
		</p>
		<div class="flex items-center gap-1">
			<button
				type="button"
				class="chatbot-icon-btn flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-fg"
				aria-label="Toggle history"
				onclick={() => (showSidebar = !showSidebar)}
			>
				<span class="i-lucide-history h-4 w-4"></span>
			</button>
			<button
				type="button"
				class="chatbot-icon-btn flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-fg"
				aria-label="New chat"
				onclick={() => session.newChat()}
			>
				<span class="i-lucide-plus h-4 w-4"></span>
			</button>
			<button
				type="button"
				class="chatbot-icon-btn flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-fg"
				aria-label="Minimize"
				onclick={() => session.minimize()}
			>
				<span class="i-lucide-minus h-4 w-4"></span>
			</button>
			<button
				type="button"
				class="chatbot-icon-btn flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-fg"
				aria-label="Close"
				onclick={() => session.close()}
			>
				<span class="i-lucide-x h-4 w-4"></span>
			</button>
		</div>
	</div>

	<div class="flex flex-1 overflow-hidden">
		<!-- History sidebar -->
		{#if showSidebar}
			<div class="chatbot-sidebar flex w-48 shrink-0 flex-col border-r border-border">
				<div class="flex-1 overflow-y-auto">
					{#if conversationsError}
						<p class="p-3 text-center text-fluid-xs text-muted">Could not load history.</p>
					{:else if conversations.length === 0}
						<p class="p-3 text-center text-fluid-xs text-muted">No conversations yet</p>
					{:else}
						{#each conversations as conv (conv.id)}
							<div class="chatbot-conv-item flex items-center gap-1 px-2 py-2">
								<button
									type="button"
									class={cn(
										'flex-1 truncate text-left text-fluid-xs',
										conv.id === session.conversationId
											? 'font-semibold text-fg'
											: 'text-muted hover:text-fg'
									)}
									onclick={() => loadConversation(conv)}
								>
									{conv.title}
								</button>
								{#if pendingDeleteId === conv.id}
									<button
										type="button"
										class="shrink-0 text-fluid-xs font-medium text-error-fg"
										onclick={() => deleteConversation(conv.id)}
										aria-label="Confirm delete conversation"
									>Yes</button>
									<button
										type="button"
										class="shrink-0 text-fluid-xs text-muted"
										onclick={() => (pendingDeleteId = null)}
										aria-label="Cancel delete"
									>No</button>
								{:else}
									<button
										type="button"
										class="chatbot-delete-btn shrink-0 text-muted hover:text-error-fg"
										aria-label="Delete conversation"
										onclick={() => (pendingDeleteId = conv.id)}
									>
										<span class="i-lucide-trash-2 h-3 w-3"></span>
									</button>
								{/if}
							</div>
						{/each}
					{/if}
				</div>
			</div>
		{/if}

		<!-- Chat area. Minimize when the user follows one of Vely's links so the destination
		     page renders unobstructed (the thread reports the click before navigation). -->
		<div class="flex flex-1 flex-col overflow-hidden">
			<ChatThread visible={session.phase === 'open'} onfollowlink={() => session.minimize()} />

			<!-- Gated: the chip slot carries a real, focusable sign-in link — it doubles as
			     the aria-describedby target for the disabled input below. The site-awareness
			     chip is suppressed while gated ("Asking about X" implies live context that
			     doesn't exist when nothing can be sent). -->
			{#if gated}
				<div class="flex items-center gap-1.5 border-t border-border px-4 py-1.5 text-fluid-xs">
					<span class="i-lucide-lock h-3 w-3 shrink-0 text-muted" aria-hidden="true"></span>
					<a
						id="vely-signin-hint"
						href={loginHref}
						onclick={() => session.markReopenIntent()}
						class="py-1 text-fg underline"
					>
						{m.ai_chat_signin_hint()}
					</a>
				</div>
				<!-- Site-awareness disclosure chip: names the page Vely is aware of, directly above
			     where the user types "this". Present ⟺ a route is sent this turn. Hidden on
			     private/unknown routes. See docs/blueprint/ai/site-awareness.md. -->
			{:else if pageLabel}
				<div
					class="flex items-center gap-1.5 border-t border-border px-4 py-1.5 text-fluid-xs text-muted"
					data-testid="vely-page-context"
				>
					<span class="i-lucide-map-pin h-3 w-3 shrink-0" aria-hidden="true"></span>
					<span class="truncate">{m.ai_chat_page_context({ pageLabel })}</span>
				</div>
			{/if}

			<!-- Input -->
			<ChatInput
				bind:value={inputValue}
				loading={isLoading}
				signedOut={gated}
				signedOutHintId="vely-signin-hint"
				onsubmit={submitMessage}
				onstop={() => session.stop()}
			/>
		</div>
	</div>
</aside>

<style>
	.chatbot-icon-btn:hover {
		background-color: color-mix(in srgb, var(--color-muted) 15%, transparent);
	}

	.chatbot-sidebar {
		background-color: color-mix(in srgb, var(--color-muted) 5%, transparent);
	}

	.chatbot-conv-item:hover .chatbot-delete-btn {
		opacity: 1;
	}

	.chatbot-delete-btn {
		opacity: 0.3;
	}

	.chatbot-delete-btn:focus-visible {
		opacity: 1;
	}
</style>
