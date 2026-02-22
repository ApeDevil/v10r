<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { Chat } from '@ai-sdk/svelte';
	import { cn } from '$lib/utils/cn';
	import ChatMessage from './ChatMessage.svelte';
	import ChatInput from './ChatInput.svelte';

	interface Props {
		open: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	const chat = new Chat({ api: '/api/ai/chat' });

	const isLoading = $derived(chat.status === 'submitted' || chat.status === 'streaming');

	let scrollContainer: HTMLDivElement | undefined = $state();

	// Auto-scroll to bottom when messages change
	$effect(() => {
		if (chat.messages.length && scrollContainer) {
			requestAnimationFrame(() => {
				if (scrollContainer) {
					scrollContainer.scrollTop = scrollContainer.scrollHeight;
				}
			});
		}
	});

	function submitMessage() {
		if (!chat.input.trim() || isLoading) return;
		chat.handleSubmit();
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
					<span class="i-lucide-bot h-5 w-5 text-primary"></span>
					<span class="text-fluid-base font-semibold text-fg">AI Assistant</span>
				</div>
				<Dialog.Close
					class="chatbot-close flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-fg"
					aria-label="Close"
				>
					<span class="i-lucide-x h-4 w-4"></span>
				</Dialog.Close>
			</div>

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
							<ChatMessage role={message.role as 'user' | 'assistant'} content={message.content} />
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
				<div class="chatbot-error mx-3 mb-2 rounded-md px-3 py-2 text-fluid-sm">
					{chat.error.message}
				</div>
			{/if}

			<!-- Input -->
			<ChatInput bind:value={chat.input} loading={isLoading} onsubmit={submitMessage} />
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.chatbot-close):hover {
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
