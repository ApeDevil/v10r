<script lang="ts">
import { Chat } from '@ai-sdk/svelte';
import { DefaultChatTransport } from 'ai';
import { page } from '$app/state';
import { CSRF_HEADER } from '$lib/api';
import { Alert, BoundaryFallback, Card, EmptyState } from '$lib/components/composites';
import ChatInput from '$lib/components/composites/chatbot/ChatInput.svelte';
import ChatMessage from '$lib/components/composites/chatbot/ChatMessage.svelte';
import { Stack } from '$lib/components/layout';
import { Button, Typography } from '$lib/components/primitives';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';

let { data } = $props();

let inputValue = $state('');

// Typed auth signal from the transport — a mid-session 401 never reaches
// chat.error with its status, only the raw body text.
let authRequired = $state(false);

const chat = new Chat({
	transport: new DefaultChatTransport({
		api: '/api/ai/deskbot',
		headers: CSRF_HEADER,
		fetch: async (url, init) => {
			const response = await fetch(url, init);
			if (response.status === 401) authRequired = true;
			return response;
		},
	}) as Chat['transport'],
});

const isLoading = $derived(chat.status === 'submitted' || chat.status === 'streaming');
const gated = $derived(!data.signedIn || authRequired);
const loginHref = $derived(
	`${localizeHref('/auth/login')}?returnTo=${encodeURIComponent(page.url.pathname + page.url.search)}`,
);

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
	if (gated || !inputValue.trim() || isLoading) return;
	const text = inputValue;
	inputValue = '';
	chat.sendMessage({ text });
}
</script>
	<Stack gap="6">
		{#if !data.configured}
			<Alert variant="info" title="AI Not Configured">
				<p>Configure an AI provider in your <code>.env</code> file to enable the chat demo.</p>
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
								{#if gated}
									<EmptyState icon="i-lucide-lock h-10 w-10" title={m.ai_chat_signin_gate()} class="chat-empty">
										<Button variant="primary" size="lg" class="justify-center" href={loginHref}>
											{m.ai_chat_signin_action()}
										</Button>
									</EmptyState>
								{:else}
									<EmptyState
										icon="i-lucide-message-circle h-10 w-10"
										title="Start chatting"
										description="Send a message to start chatting."
										class="chat-empty"
									/>
								{/if}
							{:else}
								{#each chat.messages as message (message.id)}
									<ChatMessage role={message.role as 'user' | 'assistant'} parts={message.parts} />
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

						<!-- Gate precedence: a live 401 sets both `authRequired` and chat.error —
						     the auth branch must win over the generic error copy. -->
						{#if gated}
							{#if chat.messages.length > 0}
								<div class="chat-error mx-3 mb-2 rounded-md px-3 py-2 text-fluid-sm" role="alert" aria-live="polite">
									<span class="font-medium">{m.errors_auth_session_expired()}</span>
									<a class="underline" href={loginHref}>{m.ai_chat_signin_action()}</a>
								</div>
							{/if}
							<p id="showcase-chat-signin-hint" class="chat-signin-hint text-fluid-xs">
								<a class="text-fg underline" href={loginHref}>{m.ai_chat_signin_hint()}</a>
							</p>
						{:else if chat.error}
							{@const errMsg = chat.error.message ?? ''}
							<div class="chat-error mx-3 mb-2 rounded-md px-3 py-2 text-fluid-sm" role="alert" aria-live="polite">
								<span class="font-medium">{m.ai_chat_error_heading()}</span>
								{#if errMsg.includes('rate_limited') || errMsg.includes('429')}
									{m.ai_chat_error_rate_limited()}
								{:else if errMsg.includes('ai_unavailable') || errMsg.includes('503')}
									{m.ai_chat_error_unavailable()}
								{:else}
									{m.ai_chat_error_generic()}
								{/if}
							</div>
						{/if}

						<ChatInput
							bind:value={inputValue}
							loading={isLoading}
							signedOut={gated}
							signedOutHintId="showcase-chat-signin-hint"
							onsubmit={submitMessage}
						/>
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

	.chat-signin-hint {
		margin: 0;
		padding: var(--spacing-2) var(--spacing-3);
		text-align: center;
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
