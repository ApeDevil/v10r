<script lang="ts">
import { Chat } from '@ai-sdk/svelte';
import { Dialog } from 'bits-ui';
import { apiFetch, CSRF_HEADER } from '$lib/api';
import { cn } from '$lib/utils/cn';
import ChatInput from './ChatInput.svelte';
import ChatMessage from './ChatMessage.svelte';

interface Conversation {
	id: string;
	title: string;
	updatedAt: string;
}

interface Props {
	open: boolean;
}

let { open = $bindable(false) }: Props = $props();

let conversationId: string | undefined = $state();
let conversations: Conversation[] = $state([]);
let conversationsError = $state(false);
let showSidebar = $state(false);
let pendingDeleteId: string | null = $state(null);

const chat = new Chat({
	api: '/api/ai/chat',
	headers: CSRF_HEADER,
	onResponse: (response: Response) => {
		const id = response.headers.get('X-Conversation-Id');
		if (id) conversationId = id;
	},
});

const isLoading = $derived(chat.status === 'submitted' || chat.status === 'streaming');

let scrollContainer: HTMLDivElement | undefined = $state();

$effect(() => {
	if (chat.messages.length && scrollContainer) {
		requestAnimationFrame(() => {
			if (scrollContainer) {
				scrollContainer.scrollTop = scrollContainer.scrollHeight;
			}
		});
	}
});

// Load conversations when dialog opens
$effect(() => {
	if (open) {
		loadConversations();
	}
});

// Refresh conversation list when streaming finishes (replaces setTimeout)
$effect(() => {
	if (chat.status === 'ready' && !conversationId && chat.messages.length > 0) {
		loadConversations();
	}
});

async function loadConversations() {
	conversationsError = false;
	try {
		const res = await fetch('/api/ai/conversations');
		if (res.ok) {
			const json = await res.json();
			conversations = json.data;
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
		conversationId = conv.id;
		chat.messages = data.messages.map((m: { id: string; role: string; content: string }) => ({
			id: m.id,
			role: m.role,
			content: m.content,
		}));
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
			if (conversationId === id) {
				startNewChat();
			}
		}
	} catch {
		// silently fail
	} finally {
		pendingDeleteId = null;
	}
}

function startNewChat() {
	conversationId = undefined;
	chat.messages = [];
	chat.input = '';
}

function submitMessage() {
	if (!chat.input.trim() || isLoading) return;
	chat.sendMessage({
		text: chat.input,
		body: conversationId ? { conversationId } : {},
	});
}

function formatRelativeTime(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-overlay bg-black/50" />
		<Dialog.Content
			class={cn(
				'fixed right-4 bottom-4 z-modal',
				'flex h-[min(600px,80vh)] w-full max-w-md flex-col',
				'rounded-lg border border-border bg-surface-3 shadow-xl'
			)}
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-border px-4 py-3">
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="chatbot-icon-btn flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-fg"
						aria-label="Toggle history"
						onclick={() => (showSidebar = !showSidebar)}
					>
						<span class="i-lucide-history h-4 w-4"></span>
					</button>
					<Dialog.Title class="text-fluid-base font-semibold text-fg">AI Assistant</Dialog.Title>
				</div>
				<div class="flex items-center gap-1">
					<button
						type="button"
						class="chatbot-icon-btn flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-fg"
						aria-label="New chat"
						onclick={startNewChat}
					>
						<span class="i-lucide-plus h-4 w-4"></span>
					</button>
					<Dialog.Close
						class="chatbot-icon-btn flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-fg"
						aria-label="Close"
					>
						<span class="i-lucide-x h-4 w-4"></span>
					</Dialog.Close>
				</div>
			</div>
			<Dialog.Description class="sr-only">
				Chat with the AI assistant. Your conversation history is saved automatically.
			</Dialog.Description>

			<div class="flex flex-1 overflow-hidden">
				<!-- Sidebar -->
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
												conv.id === conversationId ? 'font-semibold text-fg' : 'text-muted hover:text-fg'
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
						{#if chat.messages.length === 0}
							<div class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
								<span class="i-lucide-message-circle h-10 w-10 text-muted"></span>
								<p class="text-fluid-sm text-muted">Ask me anything about web development.</p>
							</div>
						{:else}
							<div class="flex flex-col gap-1 py-2">
								{#each chat.messages as message (message.id)}
									<ChatMessage
									role={message.role as 'user' | 'assistant'}
									parts={message.parts}
									content={message.content}
								/>
								{/each}

								{#if isLoading && chat.messages[chat.messages.length - 1]?.role === 'user'}
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
						{/if}
					</div>

					<!-- Error display -->
					{#if chat.error}
						<div class="chatbot-error mx-3 mb-2 rounded-md px-3 py-2 text-fluid-sm" role="alert" aria-live="polite">
							<span class="font-medium">Could not get a response.</span>
							{#if chat.error.message?.includes('429')}
								You've reached the rate limit. Please wait a moment.
							{:else if chat.error.message?.includes('401') || chat.error.message?.includes('Sign in')}
								Sign in to use the AI assistant.
							{:else if chat.error.message?.includes('503')}
								The AI service is temporarily unavailable.
							{:else}
								Something went wrong. Try again.
							{/if}
						</div>
					{/if}

					<!-- Input -->
					<ChatInput bind:value={chat.input} loading={isLoading} onsubmit={submitMessage} />
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

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
