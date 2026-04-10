<script lang="ts">
import { Chat } from '@ai-sdk/svelte';
import { DefaultChatTransport } from 'ai';
import { onDestroy } from 'svelte';
import { CSRF_HEADER } from '$lib/api';
import ChatInput from '$lib/components/composites/chatbot/ChatInput.svelte';
import ChatMessage from '$lib/components/composites/chatbot/ChatMessage.svelte';
import {
	appendIOLog,
	findLeafWithPanel,
	getDeskBus,
	getDockContext,
	getEnabledScopes,
	getWorkspaceContext,
	markResponseReceived,
	registerPanelMenus,
	serializeForRequest,
} from '$lib/components/composites/dock';
import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
import type { DeskEffect } from '$lib/server/ai/tools/_types';
import BotManagerDialog from './BotManagerDialog.svelte';
import ContextTray from './ContextTray.svelte';
import { chatStateCache } from './chat-state-cache';

interface Props {
	panelId: string;
}

let { panelId }: Props = $props();

// svelte-ignore state_referenced_locally
const cached = chatStateCache.get(panelId);
let conversationId: string | undefined = $state(cached?.conversationId);
let inputValue = $state('');
let lastErrorKind = $state<string | null>(null);
let managerOpen = $state(false);

const bus = getDeskBus();
const dock = getDockContext();
const wsState = getWorkspaceContext();

const ERROR_MESSAGES: Record<string, string> = {
	rate_limit: 'Rate limit reached. Wait a moment and try again.',
	timeout: 'AI service timed out. Try again.',
	unavailable: 'AI service is temporarily unavailable.',
	context_length: 'Message too long. Try a shorter message.',
	authentication: 'AI authentication failed. Check provider config.',
	model: 'AI model unavailable. Try again later.',
};

/** Classify an error kind from message text when no header is available. */
function classifyErrorMessage(msg: string): string | null {
	const lower = msg.toLowerCase();
	if (lower.includes('rate') || lower.includes('quota') || lower.includes('429') || lower.includes('too many'))
		return 'rate_limit';
	if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('etimedout')) return 'timeout';
	if (lower.includes('unavailable') || lower.includes('503') || lower.includes('fetch failed')) return 'unavailable';
	if (lower.includes('context length') || lower.includes('too long') || lower.includes('token'))
		return 'context_length';
	if (lower.includes('401') || lower.includes('403') || lower.includes('authentication')) return 'authentication';
	if (lower.includes('model') || lower.includes('404')) return 'model';
	return null;
}

const chat = new Chat({
	...(cached?.messages?.length ? { messages: cached.messages as Chat['messages'] } : {}),
	transport: new DefaultChatTransport({
		api: '/api/ai/chat',
		headers: CSRF_HEADER,
		fetch: async (url, init) => {
			const response = await fetch(url, init);
			const id = response.headers.get('X-Conversation-Id');
			if (id) conversationId = id;
			const errorKind = response.headers.get('X-AI-Error-Kind');
			if (errorKind) {
				lastErrorKind = errorKind;
				const msg = ERROR_MESSAGES[errorKind] ?? 'Something went wrong.';
				appendIOLog({ source: 'effect', level: 'error', label: `AI error: ${msg}`, detail: errorKind });
			}
			return response;
		},
	}) as Chat['transport'],
	onFinish: () => {
		markResponseReceived();
	},
});

// Persist state when component is destroyed (panel move / close)
onDestroy(() => {
	if (chat.messages.length > 0 || conversationId) {
		chatStateCache.set(panelId, {
			conversationId,
			messages: $state.snapshot(chat.messages) as typeof chat.messages,
		});
	}
});

const isLoading = $derived(chat.status === 'submitted' || chat.status === 'streaming');

// ── Error classification (stream errors bypass response headers) ──

$effect(() => {
	const err = chat.error;
	if (!err) return;
	if (lastErrorKind) return; // already classified via header
	const kind = classifyErrorMessage(err.message ?? '');
	if (kind) lastErrorKind = kind;
	const msg = ERROR_MESSAGES[kind ?? ''] ?? 'Something went wrong.';
	appendIOLog({ source: 'effect', level: 'error', label: `AI error: ${msg}`, detail: kind ?? 'unknown' });
});

// ── AI desk effect dispatch ─────────────────────────────────────

/** Track which tool call IDs we've already dispatched effects for. */
const processedToolCalls = new Set<string>();

/**
 * Watch assistant messages for settled tool-invocation parts.
 * Extract DeskEffect from tool results and dispatch to desk bus / dock.
 */
$effect(() => {
	const messages = chat.messages;
	if (!messages.length) return;

	const lastMsg = messages[messages.length - 1];
	if (lastMsg.role !== 'assistant' || !lastMsg.parts) return;

	for (const part of lastMsg.parts) {
		if (part.type !== 'tool-invocation') continue;
		const inv = part as unknown as {
			toolCallId: string;
			toolName: string;
			state: string;
			output?: { effects?: DeskEffect[]; error?: string };
		};

		const callKey = `${inv.toolCallId}-${inv.state}`;
		if (processedToolCalls.has(callKey)) continue;
		processedToolCalls.add(callKey);

		if (inv.state === 'call') {
			appendIOLog({
				source: 'tool-call',
				toolName: inv.toolName,
				label: `Calling ${inv.toolName}...`,
			});
		} else if (inv.state === 'result') {
			appendIOLog({
				source: 'tool-result',
				toolName: inv.toolName,
				label: inv.output?.error ? `${inv.toolName} failed` : `${inv.toolName} completed`,
				level: inv.output?.error ? 'error' : 'success',
			});

			const effects = inv.output?.effects;
			if (effects) {
				for (const effect of effects) {
					dispatchDeskEffect(effect);
				}
			}
		}
	}
});

function dispatchDeskEffect(effect: DeskEffect) {
	switch (effect.type) {
		case 'desk:open_panel': {
			const existingLeaf = findLeafWithPanel(dock.root, `${effect.panelType}-${effect.fileId}`);
			if (existingLeaf) {
				dock.activateTab(existingLeaf.id, `${effect.panelType}-${effect.fileId}`);
			} else {
				const newPanelId = `${effect.panelType}-${effect.fileId}`;
				dock.addPanel({
					id: newPanelId,
					type: effect.panelType,
					label: effect.label,
					closable: true,
					meta: { fileId: effect.fileId },
				});
			}
			break;
		}
		case 'desk:refresh_file':
			bus.publish('ai:refresh_file', { fileId: effect.fileId });
			break;
		case 'desk:refresh_explorer':
			bus.publish('ai:refresh_explorer', {});
			break;
		case 'desk:tab_indicator':
			dock.updatePanel(`${effect.panelType}-${effect.fileId}`, {
				indicator: effect.variant === 'modified' ? 'ai-modified' : undefined,
			});
			break;
		case 'desk:notify':
			bus.publish('ai:notify', { message: effect.message, level: effect.level });
			break;
	}
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
	inputValue = '';
	chatStateCache.delete(panelId);
}

function submitMessage() {
	if (!inputValue.trim() || isLoading) return;
	lastErrorKind = null;
	const context = serializeForRequest();

	// Log context reads to I/O log
	for (const ctx of context) {
		appendIOLog({
			source: 'context-read',
			label: `${ctx.panelType}: ${ctx.label}`,
			detail: `${ctx.content.length} chars`,
		});
	}
	appendIOLog({ source: 'progress', label: 'Sending message...' });

	const text = inputValue;
	inputValue = '';

	chat.sendMessage(
		{ text },
		{
			body: {
				...(conversationId ? { conversationId } : {}),
				...(context.length > 0 ? { panelContext: context } : {}),
				toolScopes: getEnabledScopes(),
				...(wsState.active ? { activeWorkspace: { id: wsState.active.id, name: wsState.active.name } } : {}),
			},
		},
	);
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

// svelte-ignore state_referenced_locally
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
					<ChatMessage
						role={message.role as 'user' | 'assistant'}
						parts={message.parts}
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
			{ERROR_MESSAGES[lastErrorKind ?? ''] ?? 'Something went wrong. Try again.'}
		</div>
	{/if}

	<!-- Context tray -->
	<ContextTray onopensettings={() => managerOpen = true} />

	<!-- Input (reuse existing ChatInput) -->
	<ChatInput bind:value={inputValue} loading={isLoading} onsubmit={submitMessage} />

	<!-- Bot Manager Dialog -->
	<BotManagerDialog bind:open={managerOpen} />
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
