<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';
	import { CSRF_HEADER } from '$lib/api';
	import { Card, Alert, EmptyState, BoundaryFallback } from '$lib/components/composites';
	import { Typography } from '$lib/components/primitives';
	import { Stack } from '$lib/components/layout';
	import ChatMessage from '$lib/components/composites/chatbot/ChatMessage.svelte';
	import ChatInput from '$lib/components/composites/chatbot/ChatInput.svelte';

	let { data } = $props();

	const chat = new Chat({ api: '/api/ai/chat', headers: CSRF_HEADER });

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

	function submitMessage() {
		if (!chat.input.trim() || isLoading) return;
		chat.handleSubmit();
	}
</script>

<svelte:head>
	<title>Chat - AI - Showcases - Velociraptor</title>
</svelte:head>

	<Stack gap="6">
		{#if !data.configured}
			<Alert variant="info" title="AI Not Configured">
				<p>Configure an AI provider in your <code>.env</code> file to enable the chat demo.</p>
				<p>See <a href="/showcases/ai/connection">Connection</a> for setup instructions.</p>
			</Alert>
		{:else}
			<svelte:boundary>
				<Card class="chat-card">
					{#snippet header()}
						<Typography variant="h5" as="h2">AI Chat</Typography>
					{/snippet}

					<div class="chat-container">
						<div bind:this={scrollContainer} class="chat-messages">
							{#if chat.messages.length === 0}
								<EmptyState
									icon="i-lucide-message-circle h-10 w-10"
									title="Start chatting"
									description="Send a message to start chatting."
									class="chat-empty"
								/>
							{:else}
								{#each chat.messages as message (message.id)}
									<ChatMessage role={message.role as 'user' | 'assistant'} content={message.content} />
								{/each}

								{#if isLoading && chat.messages[chat.messages.length - 1]?.role === 'user'}
									<div class="chat-typing flex items-center gap-3 px-4 py-3">
										<div class="chat-typing-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
											<span class="i-lucide-bot h-4 w-4"></span>
										</div>
										<div class="chat-typing-dots flex gap-1">
											<span class="chat-dot"></span>
											<span class="chat-dot"></span>
											<span class="chat-dot"></span>
										</div>
									</div>
								{/if}
							{/if}
						</div>

						{#if chat.error}
							<div class="chat-error mx-3 mb-2 rounded-md px-3 py-2 text-fluid-sm" role="alert" aria-live="polite">
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

						<ChatInput bind:value={chat.input} loading={isLoading} onsubmit={submitMessage} />
					</div>
				</Card>

				{#snippet failed(error, reset)}
					<BoundaryFallback
						title="AI chat unavailable"
						description="The AI response stream was interrupted. Check your API key configuration."
						{reset}
					/>
				{/snippet}
			</svelte:boundary>
		{/if}
	</Stack>

<style>
	:global(.chat-card) {
		padding: 0 !important;
	}

	.chat-container {
		display: flex;
		flex-direction: column;
		height: min(500px, 60vh);
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	:global(.chat-empty) {
		height: 100%;
		min-height: 0;
		padding: var(--spacing-6);
	}

	.chat-error {
		background-color: color-mix(in srgb, var(--color-error-fg) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-error-fg) 20%, transparent);
		color: var(--color-error-fg);
	}

	.chat-typing-avatar {
		background-color: color-mix(in srgb, var(--color-muted) 20%, transparent);
		color: var(--color-fg);
	}

	.chat-typing-dots {
		padding: 8px 12px;
		border-radius: var(--radius-lg);
		background-color: color-mix(in srgb, var(--color-muted) 12%, transparent);
	}

	.chat-dot {
		display: block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--color-muted);
		animation: chat-bounce 1.4s infinite ease-in-out both;
	}

	.chat-dot:nth-child(1) { animation-delay: -0.32s; }
	.chat-dot:nth-child(2) { animation-delay: -0.16s; }

	@keyframes chat-bounce {
		0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
		40% { transform: scale(1); opacity: 1; }
	}
</style>
