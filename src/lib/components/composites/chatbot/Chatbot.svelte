<script lang="ts">
import { MediaQuery } from 'svelte/reactivity';
import { page } from '$app/state';
import { apiFetch } from '$lib/api';
import ChunkView from '$lib/components/chat/ChunkView.svelte';
import type { CatalogSource, SourceChunk } from '$lib/components/chat/citation-types';
import Drawer from '$lib/components/primitives/drawer/Drawer.svelte';
import { isSiteAwareRoute, resolveRouteLabel } from '$lib/search/route-id';
import { chatbotSession } from '$lib/state/chatbot-session.svelte';
import { layerStack } from '$lib/state/layer-stack.svelte';
import { useSurface } from '$lib/styles/elevation';
import { cn } from '$lib/utils/cn';
import ChatInput from './ChatInput.svelte';
import ChatMessage from './ChatMessage.svelte';

interface Conversation {
	id: string;
	title: string;
	updatedAt: string;
}

// The live thread lives in the module singleton (survives minimize + cross-group
// AppShell remount). This component is a pure projection of it.
const session = chatbotSession;

// Relative elevation — the docked assistant panel sits one rung above the page plane.
const s = useSurface();

let conversations: Conversation[] = $state([]);
let conversationsError = $state(false);
let showSidebar = $state(false);
let pendingDeleteId: string | null = $state(null);
let inputValue = $state('');

let panelEl: HTMLElement | undefined = $state();
let scrollContainer: HTMLDivElement | undefined = $state();

// Source-chunk viewer: one Drawer instance, opened with the clicked message's drilled
// chunks. Responsive: side panel on desktop, bottom sheet on mobile.
let viewerOpen = $state(false);
let viewerChunks = $state<SourceChunk[]>([]);
const isDesktop = new MediaQuery('(min-width: 768px)', true);

const isLoading = $derived(session.isStreaming);

// Site-awareness disclosure: the human label of the page Vely is currently aware of.
// Null on private/unknown routes → the chip hides (the honest "not reading this page" signal).
// Live present-tense: reflects the CURRENT route, so it reads as the antecedent of "this".
const pageLabel = $derived(resolveRouteLabel(page.route.id));

function openChunks(chunks: SourceChunk[]) {
	viewerChunks = chunks;
	viewerOpen = true;
}

// Auto-scroll to the latest message (only while visibly open).
$effect(() => {
	const len = session.chat?.messages.length ?? 0;
	if (len && scrollContainer && session.phase === 'open') {
		requestAnimationFrame(() => {
			if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
		});
	}
});

// Load the history list when the panel opens.
$effect(() => {
	if (session.phase === 'open') loadConversations();
});

// Refresh history once a brand-new conversation gets persisted (first turn).
$effect(() => {
	if (session.chat?.status === 'ready' && !session.conversationId && (session.chat?.messages.length ?? 0) > 0) {
		loadConversations();
	}
});

// Minimize when the user follows one of Vely's links (same-tab, primary-button,
// same-origin) so the destination page renders unobstructed. Fired synchronously
// BEFORE navigation; we do NOT preventDefault — SvelteKit's <a> nav proceeds. Attached
// as a real listener (not an inline handler) to keep the messages container a plain,
// non-interactive scroll region.
function onMessagesClick(e: MouseEvent) {
	if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
	const a = (e.target as HTMLElement | null)?.closest('a[href]') as HTMLAnchorElement | null;
	if (!a || a.target === '_blank' || a.origin !== location.origin) return;
	session.minimize();
}

$effect(() => {
	const el = scrollContainer;
	if (!el) return;
	el.addEventListener('click', onMessagesClick);
	return () => el.removeEventListener('click', onMessagesClick);
});

// The mobile bottom sheet behaves modally (covers the page) — register it as a
// dismissal layer. The desktop dock is a persistent workspace panel and never registers.
$effect(() => {
	if (session.phase === 'open' && !isDesktop.current) {
		layerStack.push('chatbot-sheet');
		return () => layerStack.pop('chatbot-sheet');
	}
});

// Esc minimizes (never destroys) when focus is inside the open panel. If the sources
// drawer is open, leave it to the drawer's own Esc handling.
function onWindowKeydown(e: KeyboardEvent) {
	if (e.key !== 'Escape' || viewerOpen) return;
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
		await session.adoptConversation(conv.id, data.messages);
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
	if (!inputValue.trim() || isLoading) return;
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
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-border px-4 py-3">
		<p class="text-fluid-base text-fg">
			<span class="font-semibold">Vely</span> <span class="font-light text-muted">chatbot</span>
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

		<!-- Chat area -->
		<div class="flex flex-1 flex-col overflow-hidden">
			<!-- Messages -->
			<div bind:this={scrollContainer} class="flex-1 overflow-y-auto">
				{#if session.chat && session.chat.messages.length > 0}
					{@const messages = session.chat.messages}
					<div class="flex flex-col gap-1 py-2">
						{#each messages as message (message.id)}
							<ChatMessage
								role={message.role as 'user' | 'assistant'}
								parts={message.parts}
								catalogSources={(message as { metadata?: { catalogSources?: CatalogSource[] } })
									.metadata?.catalogSources}
								sourceChunks={(message as { metadata?: { sourceChunks?: SourceChunk[] } }).metadata
									?.sourceChunks}
								onviewchunks={openChunks}
							/>
						{/each}

						{#if isLoading && messages[messages.length - 1]?.role === 'user'}
							<div class="flex items-center gap-3 px-4 py-3">
								<div class="chatbot-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
									<span class="i-lucide-bot h-4 w-4"></span>
								</div>
								<div class="chatbot-typing flex gap-1">
									<span class="chatbot-dot"></span>
									<span class="chatbot-dot"></span>
									<span class="chatbot-dot"></span>
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<div class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
						<span class="i-lucide-message-circle h-10 w-10 text-muted"></span>
						<p class="text-fluid-sm text-muted">Ask me anything about web development.</p>
					</div>
				{/if}
			</div>

			<!-- Error display -->
			{#if session.chat?.error}
				{@const errMsg = session.chat.error.message ?? ''}
				<div class="chatbot-error mx-3 mb-2 rounded-md px-3 py-2 text-fluid-sm" role="alert" aria-live="polite">
					<span class="font-medium">Could not get a response.</span>
					{#if errMsg.includes('429')}
						You've reached the rate limit. Please wait a moment.
					{:else if errMsg.includes('401') || errMsg.includes('Sign in')}
						Sign in to chat with Vely.
					{:else if errMsg.includes('503')}
						The AI service is temporarily unavailable.
					{:else}
						Something went wrong. Try again.
					{/if}
				</div>
			{/if}

			<!-- Site-awareness disclosure chip: names the page Vely is aware of, directly above
			     where the user types "this". Present ⟺ a route is sent this turn. Hidden on
			     private/unknown routes. See docs/blueprint/ai/site-awareness.md. -->
			{#if pageLabel}
				<div
					class="flex items-center gap-1.5 border-t border-border px-4 py-1.5 text-fluid-xs text-muted"
					data-testid="vely-page-context"
				>
					<span class="i-lucide-map-pin h-3 w-3 shrink-0" aria-hidden="true"></span>
					<span class="truncate">Asking about <span class="font-medium text-fg">{pageLabel}</span></span>
				</div>
			{/if}

			<!-- Input -->
			<ChatInput bind:value={inputValue} loading={isLoading} onsubmit={submitMessage} />
		</div>
	</div>
</aside>

<!-- Source-chunk viewer (one instance). Side panel on desktop, bottom sheet on mobile. -->
<Drawer bind:open={viewerOpen} side={isDesktop.current ? 'right' : 'bottom'} title="Sources">
	<div class="flex flex-col gap-3">
		{#each viewerChunks as chunk (chunk.chunkId)}
			<ChunkView {chunk} />
		{/each}
	</div>
</Drawer>

<style>
	.chatbot-icon-btn:hover {
		background-color: color-mix(in srgb, var(--color-muted) 15%, transparent);
	}

	.chatbot-avatar {
		background-color: color-mix(in srgb, var(--color-muted) 20%, transparent);
		color: var(--color-fg);
	}

	.chatbot-error {
		background-color: color-mix(in srgb, var(--color-error-fg) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-error-fg) 20%, transparent);
		color: var(--color-error-fg);
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

	/* Typing indicator dots */
	.chatbot-typing {
		padding: 8px 12px;
		border-radius: 8px;
		background-color: color-mix(in srgb, var(--color-muted) 12%, transparent);
	}

	.chatbot-dot {
		display: block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--color-muted);
		animation: chatbot-bounce 1.4s infinite ease-in-out both;
	}

	.chatbot-dot:nth-child(1) { animation-delay: -0.32s; }
	.chatbot-dot:nth-child(2) { animation-delay: -0.16s; }

	@keyframes chatbot-bounce {
		0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
		40% { transform: scale(1); opacity: 1; }
	}
</style>
