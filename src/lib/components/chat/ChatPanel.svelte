<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';
	import { CSRF_HEADER } from '$lib/api';
	import {
		dismissContext,
		getContextChips,
		getTokenEstimate,
		markResponseReceived,
		pinContext,
		registerPanelMenus,
		serializeForRequest,
		unpinContext,
	} from '$lib/components/composites/dock';
	import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
	import ChatInput from '$lib/components/composites/chatbot/ChatInput.svelte';
	import ChatMessage from '$lib/components/composites/chatbot/ChatMessage.svelte';
	import ContextTray from './ContextTray.svelte';

	interface Props {
		panelId: string;
	}

	let { panelId }: Props = $props();

	let conversationId: string | undefined = $state();

	const chat = new Chat({
		api: '/api/ai/chat',
		headers: CSRF_HEADER,
		onResponse: (response: Response) => {
			const id = response.headers.get('X-Conversation-Id');
			if (id) conversationId = id;
		},
		onFinish: () => {
			markResponseReceived();
		},
	});

	const isLoading = $derived(chat.status === 'submitted' || chat.status === 'streaming');

	// ── Context ─────────────────────────────────────────────────────

	const contextChips = $derived(getContextChips());
	const tokenEstimate = $derived(getTokenEstimate());

	const activeContextTypes = $derived(
		contextChips
			.filter((c) => c.status !== 'available')
			.map((c) => c.context.panelType),
	);

	const placeholder = $derived.by(() => {
		if (activeContextTypes.includes('spreadsheet')) return 'Ask about your selection...';
		if (activeContextTypes.includes('editor')) return 'Ask about this document...';
		return 'Ask anything...';
	});

	function handleDismiss(ctxPanelId: string) {
		dismissContext(ctxPanelId);
	}

	// ── Scroll ──────────────────────────────────────────────────────

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

	// ── Actions ─────────────────────────────────────────────────────

	function startNewChat() {
		conversationId = undefined;
		chat.messages = [];
		chat.input = '';
	}

	function submitMessage() {
		if (!chat.input.trim() || isLoading) return;
		const context = serializeForRequest();
		chat.handleSubmit(undefined, {
			body: {
				...(conversationId ? { conversationId } : {}),
				...(context.length > 0 ? { panelContext: context } : {}),
			},
		});
	}

	// ── Panel menus ─────────────────────────────────────────────────

	const chatMenus = $derived<MenuBarMenu[]>([
		{
			label: 'Chat',
			items: [
				{
					label: 'New Conversation',
					icon: 'i-lucide-plus',
					onSelect: startNewChat,
				},
			],
		},
	]);

	$effect(() => {
		return registerPanelMenus(panelId, { menuBar: chatMenus });
	});
</script>

<div class="chat-panel-container">
	<!-- Messages area -->
	<div bind:this={scrollContainer} class="chat-messages-area">
		{#if chat.messages.length === 0}
			<div class="chat-empty">
				<span class="i-lucide-message-circle chat-empty-icon"></span>
				<p>Ask me anything. I can see your open panels.</p>
			</div>
		{:else}
			<div class="chat-messages-list">
				{#each chat.messages as message (message.id)}
					<ChatMessage role={message.role as 'user' | 'assistant'} content={message.content} />
				{/each}

				{#if isLoading && chat.messages[chat.messages.length - 1]?.role === 'user'}
					<div class="chat-typing">
						<div class="chat-typing-avatar">
							<span class="i-lucide-bot" style="font-size: 14px;"></span>
						</div>
						<div class="chat-typing-dots">
							<span class="dot"></span>
							<span class="dot"></span>
							<span class="dot"></span>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Error display -->
	{#if chat.error}
		<div class="chat-error" role="alert" aria-live="polite">
			<span class="font-medium">Could not get a response.</span>
			{#if chat.error.message?.includes('503')}
				The AI service is temporarily unavailable.
			{:else}
				Something went wrong. Try again.
			{/if}
		</div>
	{/if}

	<!-- Context tray -->
	<ContextTray
		chips={contextChips}
		totalTokens={tokenEstimate}
		onpin={pinContext}
		onunpin={unpinContext}
		ondismiss={handleDismiss}
	/>

	<!-- Input (reuse existing ChatInput) -->
	<ChatInput bind:value={chat.input} loading={isLoading} onsubmit={submitMessage} />
</div>

<style>
	.chat-panel-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--desk-panel-bg, var(--color-bg));
	}

	.chat-messages-area {
		flex: 1;
		overflow-y: auto;
	}

	.chat-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 12px;
		padding: 24px;
		text-align: center;
		color: var(--color-muted);
		font-size: 13px;
	}

	.chat-empty-icon {
		font-size: 32px;
		opacity: 0.4;
	}

	.chat-messages-list {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 8px 0;
	}

	.chat-error {
		margin: 0 12px 8px;
		padding: 8px 12px;
		border-radius: var(--radius-md);
		font-size: 12px;
		background: color-mix(in srgb, var(--color-error-fg, #ef4444) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-error-fg, #ef4444) 20%, transparent);
		color: var(--color-error-fg, #ef4444);
	}

	/* Typing indicator */
	.chat-typing {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
	}

	.chat-typing-avatar {
		display: flex;
		width: 32px;
		height: 32px;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: color-mix(in srgb, var(--color-muted) 20%, transparent);
		color: var(--color-fg);
		flex-shrink: 0;
	}

	.chat-typing-dots {
		display: flex;
		gap: 4px;
		padding: 8px 12px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--color-muted) 12%, transparent);
	}

	.dot {
		display: block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-muted);
		animation: dot-bounce 1.4s infinite ease-in-out both;
	}

	.dot:nth-child(1) { animation-delay: -0.32s; }
	.dot:nth-child(2) { animation-delay: -0.16s; }

	@keyframes dot-bounce {
		0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
		40% { transform: scale(1); opacity: 1; }
	}
</style>
