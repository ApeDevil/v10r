<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';
	import { CSRF_HEADER } from '$lib/api';
	import {
		dismissContext,
		getAvailableToolNames,
		getContextChips,
		getDeskBus,
		getPermissionTier,
		getTokenEstimate,
		markResponseReceived,
		pinContext,
		pushUndo,
		registerPanelMenus,
		resolveToolHandler,
		serializeForRequest,
		setPermissionTier,
		unpinContext,
	} from '$lib/components/composites/dock';
	import type { PermissionTier } from '$lib/components/composites/dock';
	import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
	import ChatInput from '$lib/components/composites/chatbot/ChatInput.svelte';
	import ChatMessage from '$lib/components/composites/chatbot/ChatMessage.svelte';
	import ContextTray from './ContextTray.svelte';
	import ToolPreview from './ToolPreview.svelte';

	interface Props {
		panelId: string;
	}

	let { panelId }: Props = $props();

	let conversationId: string | undefined = $state();
	let currentTurnId: string | null = $state(null);

	const bus = getDeskBus();

	// ── Suggest mode state ──────────────────────────────────────────

	interface PendingToolCall {
		toolCallId: string;
		toolName: string;
		args: Record<string, unknown>;
		turnId: string;
	}

	let pendingToolCalls = $state<PendingToolCall[]>([]);

	function executeToolCall(toolCallId: string, toolName: string, args: Record<string, unknown>, turnId: string): string {
		const handler = resolveToolHandler(toolName);
		if (!handler) {
			return `Error: no handler for tool "${toolName}"`;
		}

		// Capture snapshot for undo before executing
		if (handler.operation.snapshot && handler.operation.restore) {
			pushUndo({
				turnId,
				panelId: handler.entity.panelId,
				toolName,
				snapshot: handler.operation.snapshot(),
				restore: handler.operation.restore,
			});
		}

		return handler.operation.execute(args);
	}

	function approveToolCall(pending: PendingToolCall) {
		const result = executeToolCall(pending.toolCallId, pending.toolName, pending.args, pending.turnId);

		bus.publish('ai:toolResult', {
			toolCallId: pending.toolCallId,
			toolName: pending.toolName,
			result,
			turnId: pending.turnId,
			_nonce: crypto.randomUUID(),
		});

		// Resume the stream
		chat.addToolResult({ toolCallId: pending.toolCallId, result });
		pendingToolCalls = pendingToolCalls.filter((p) => p.toolCallId !== pending.toolCallId);
	}

	function rejectToolCall(pending: PendingToolCall) {
		const result = 'User rejected this tool call.';

		bus.publish('ai:toolResult', {
			toolCallId: pending.toolCallId,
			toolName: pending.toolName,
			result,
			turnId: pending.turnId,
			_nonce: crypto.randomUUID(),
		});

		chat.addToolResult({ toolCallId: pending.toolCallId, result });
		pendingToolCalls = pendingToolCalls.filter((p) => p.toolCallId !== pending.toolCallId);
	}

	// ── Chat setup ──────────────────────────────────────────────────

	const chat = new Chat({
		api: '/api/ai/chat',
		headers: CSRF_HEADER,
		onResponse: (response: Response) => {
			const id = response.headers.get('X-Conversation-Id');
			if (id) conversationId = id;
			currentTurnId = crypto.randomUUID();
		},
		onFinish: () => {
			markResponseReceived();
			currentTurnId = null;
		},
		onToolCall: ({ toolCall }) => {
			const nonce = crypto.randomUUID();
			const turnId = currentTurnId ?? 'unknown';
			const tier = getPermissionTier();

			// Read-only: reject immediately
			if (tier === 'read-only') {
				return 'Tool execution is disabled (read-only mode).';
			}

			// Publish tool call event for I/O log
			bus.publish('ai:toolCall', {
				toolCallId: toolCall.toolCallId,
				toolName: toolCall.toolName,
				args: toolCall.args as Record<string, unknown>,
				turnId,
				_nonce: nonce,
			});

			// Auto mode: execute immediately
			if (tier === 'auto') {
				const result = executeToolCall(
					toolCall.toolCallId,
					toolCall.toolName,
					toolCall.args as Record<string, unknown>,
					turnId,
				);

				bus.publish('ai:toolResult', {
					toolCallId: toolCall.toolCallId,
					toolName: toolCall.toolName,
					result,
					turnId,
					_nonce: crypto.randomUUID(),
				});

				return result;
			}

			// Suggest mode: defer execution, show preview
			pendingToolCalls = [...pendingToolCalls, {
				toolCallId: toolCall.toolCallId,
				toolName: toolCall.toolName,
				args: toolCall.args as Record<string, unknown>,
				turnId,
			}];

			// Return undefined to pause the stream
			return undefined;
		},
	});

	const isLoading = $derived(chat.status === 'submitted' || chat.status === 'streaming');

	// ── Context ─────────────────────────────────────────────────────

	const contextChips = $derived(getContextChips());
	const tokenEstimate = $derived(getTokenEstimate());
	const permissionTier = $derived(getPermissionTier());

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

	function handlePermissionChange(tier: PermissionTier) {
		setPermissionTier(tier);
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
		pendingToolCalls = [];
	}

	function submitMessage() {
		if (!chat.input.trim() || isLoading) return;
		const context = serializeForRequest();
		const tier = getPermissionTier();
		const availableTools = tier !== 'read-only' ? getAvailableToolNames() : [];
		chat.handleSubmit(undefined, {
			body: {
				...(conversationId ? { conversationId } : {}),
				...(context.length > 0 ? { panelContext: context } : {}),
				...(availableTools.length > 0 ? { availableTools } : {}),
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
					{#if message.role === 'assistant' && message.toolInvocations?.length}
						{#each message.toolInvocations as invocation}
							<div class="tool-call-indicator">
								<span class="i-lucide-wrench tool-call-icon"></span>
								<span class="tool-call-name">{invocation.toolName}</span>
								{#if invocation.state === 'result'}
									<span class="tool-call-result">{typeof invocation.result === 'string' ? invocation.result.slice(0, 80) : ''}{typeof invocation.result === 'string' && invocation.result.length > 80 ? '...' : ''}</span>
								{:else if invocation.state === 'call' || invocation.state === 'partial-call'}
									<span class="tool-call-pending">executing...</span>
								{/if}
							</div>
						{/each}
					{/if}
					<ChatMessage role={message.role as 'user' | 'assistant'} content={message.content} />
				{/each}

				<!-- Pending tool call previews (suggest mode) -->
				{#each pendingToolCalls as pending (pending.toolCallId)}
					<ToolPreview
						toolName={pending.toolName}
						args={pending.args}
						onapprove={() => approveToolCall(pending)}
						onreject={() => rejectToolCall(pending)}
					/>
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
		{permissionTier}
		onpin={pinContext}
		onunpin={unpinContext}
		ondismiss={handleDismiss}
		onpermissionchange={handlePermissionChange}
	/>

	<!-- Input (reuse existing ChatInput) -->
	<ChatInput bind:value={chat.input} loading={isLoading} onsubmit={submitMessage} />
</div>

<style>
	.chat-panel-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--color-bg);
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

	/* Tool call indicator */
	.tool-call-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 16px 4px 60px;
		font-size: 11px;
		color: var(--color-muted);
	}

	.tool-call-icon {
		font-size: 11px;
		opacity: 0.6;
	}

	.tool-call-name {
		font-family: var(--font-mono);
	}

	.tool-call-result {
		opacity: 0.7;
	}

	.tool-call-pending {
		opacity: 0.5;
		font-style: italic;
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
