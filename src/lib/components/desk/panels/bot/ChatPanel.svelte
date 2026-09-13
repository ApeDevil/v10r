<script lang="ts">
/**
 * ChatPanel — the Desk Bot panel: the VIEW over a `DeskBotSession`.
 *
 * The session (`desk-bot-session.svelte.ts`) owns the live `Chat`, the conversation id,
 * every proposal's run and the effects already dispatched; it outlives this component, so
 * a layout move that remounts the panel changes nothing the user can see. What lives
 * here is what needs the component tree: the dock and bus the effects act on (lent to
 * the session as a sink while mounted), the composer, the menus, the copy.
 *
 * Permissions, in one place: typing is always allowed; Send waits while a turn streams or
 * an approval is in flight; Approve/Cancel wait for the same and only exist while the
 * card is pending; New chat waits for an approval in flight.
 */
import { page } from '$app/state';
import ChatInput from '$lib/components/composites/chatbot/ChatInput.svelte';
import ChatMessage from '$lib/components/composites/chatbot/ChatMessage.svelte';
import type { HarnessMetadata, ProposalMetadata } from '$lib/components/composites/chatbot/harness-types';
import PlanCard from '$lib/components/composites/chatbot/PlanCard.svelte';
import { citedCatalogSources, inspectTurnPath, traceOf } from '$lib/components/composites/chatbot/turn-progress';
import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
import {
	appendIOLog,
	focusPanel,
	getActiveProviderId,
	getContextChips,
	getDeskBus,
	getDockContext,
	getEnabledScopes,
	getPanelMenus,
	getWorkspaceContext,
	serializeForRequest,
} from '$lib/components/desk';
import { dispatchDeskEffect as dispatchEffect } from '$lib/components/desk/dispatch-desk-effect';
import { findLeafWithPanel } from '$lib/components/desk/dock.operations';
import { fileIdOfPanelDefinition, findFilePanel } from '$lib/components/desk/file-panel';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import type { TurnError } from '$lib/types/ai-error';
import type { DeskEffect } from '$lib/types/ai-tools';
import { CONTEXT_MAX_ENTRIES, DESK_LAYOUT_MAX_PANELS } from '$lib/types/desk-context-limits';
import BotManagerDialog from './BotManagerDialog.svelte';
import { type DeskBotSession, type DeskBotSink, getDeskBotSession } from './desk-bot-session.svelte';

interface Props {
	panelId: string;
}

let { panelId }: Props = $props();

let inputValue = $state('');
let managerOpen = $state(false);
let managerInitialTab = $state<string | undefined>();

const bus = getDeskBus();
const dock = getDockContext();
const panelMenus = getPanelMenus();
const wsState = getWorkspaceContext();

/** How long a panel gets to answer `ai:refresh_file` before the log records "not confirmed". */
const REFRESH_ACK_TIMEOUT_MS = 3_000;

const userId = $derived(page.data.session?.user?.id as string | undefined);
const workspaceId = $derived(wsState.active?.id ?? 'default');

let session = $state<DeskBotSession>();

const effectActions = {
	focusPanel: (id: string) => focusPanel(dock, id),
	addPanel: dock.addPanel,
	updatePanel: dock.updatePanel,
	publish: bus.publish,
	findFilePanel: (panelType: string, fileId: string) => findFilePanel(dock.root, dock.panels, panelType, fileId),
};

function dispatchDeskEffect(effect: DeskEffect) {
	const applied = dispatchEffect(effect, effectActions);
	if (!applied) {
		// A desk effect that did nothing must never look like one that worked.
		appendIOLog({
			source: 'tool-result',
			toolName: effect?.type ?? 'desk-effect',
			label: `Effect ${effect?.type ?? '(unknown)'} not applied — target missing`,
			level: 'error',
		});
	}
}

function awaitFileRefreshed(fileId: string) {
	return new Promise<{ fileId: string; version: number | null; ok: boolean } | null>((resolve) => {
		const timer = setTimeout(() => {
			unsubscribe();
			resolve(null);
		}, REFRESH_ACK_TIMEOUT_MS);
		const unsubscribe = bus.subscribe('ai:file_refreshed', (payload) => {
			if (payload.fileId !== fileId) return;
			clearTimeout(timer);
			unsubscribe();
			resolve(payload);
		});
	});
}

// The session is looked up on mount (client only) and lent this panel's dock and bus for
// as long as the panel is mounted. A move remounts the panel; the session does not notice.
$effect(() => {
	if (!userId) return;
	const current = getDeskBotSession(userId, workspaceId, panelId);
	const sink: DeskBotSink = { dispatchEffect: dispatchDeskEffect, awaitFileRefreshed };
	session = current;
	current.attach(sink);
	return () => current.detach(sink);
});

const messages = $derived(session?.chat.messages ?? []);
const isLoading = $derived(session?.isStreaming ?? false);
const busy = $derived(session?.isBusy ?? false);
const lastErrorKind = $derived(session?.lastErrorKind ?? null);
const activeContextCount = $derived(getContextChips().filter((c) => c.status !== 'available').length);

/** One line per failure kind, from the classified kind — never from provider prose. */
function errorCopy(kind: string | null): string {
	switch (kind) {
		case 'rate_limit':
			return m.ai_chat_error_provider_limited();
		case 'rate_limited':
			return m.ai_chat_error_rate_limited();
		case 'timeout':
			return m.composites_desk_bot_error_timeout();
		case 'unavailable':
			return m.ai_chat_error_unavailable();
		case 'context_length':
			return m.composites_desk_bot_error_context_length();
		case 'authentication':
			return m.composites_desk_bot_error_authentication();
		case 'unauthorized':
			return m.errors_auth_session_expired();
		case 'model':
			return m.composites_desk_bot_error_model();
		case 'limit_exceeded':
			return m.composites_desk_bot_error_limit_exceeded();
		default:
			return m.ai_chat_error_generic();
	}
}

function openManagerToTab(tab?: string) {
	managerInitialTab = tab;
	managerOpen = true;
}

let scrollContainer: HTMLDivElement | undefined = $state();

$effect(() => {
	if (messages.length && scrollContainer) {
		requestAnimationFrame(() => {
			if (scrollContainer) {
				scrollContainer.scrollTop = scrollContainer.scrollHeight;
			}
		});
	}
});

function startNewChat() {
	session?.newChat();
	inputValue = '';
}

/** Read the harness metadata the orchestrator streams on assistant messages. */
function getProposalForMessage(msg: unknown): ProposalMetadata | null {
	const meta = (msg as { metadata?: { harness?: HarnessMetadata } }).metadata?.harness;
	return meta?.proposal ?? null;
}

/** The open panels as the server's `desk_get_open_panels` reports them — identity only, no content. */
function deskLayout() {
	const layout: { panelId: string; fileId?: string; fileType?: string; label: string }[] = [];
	for (const panel of Object.values(dock.panels)) {
		if (!findLeafWithPanel(dock.root, panel.id)) continue;
		const fileId = fileIdOfPanelDefinition(panel) ?? undefined;
		layout.push({
			panelId: panel.id,
			label: panel.label,
			...(fileId ? { fileId } : {}),
			...(panel.type === 'spreadsheet' || panel.type === 'markdown' ? { fileType: panel.type } : {}),
		});
	}
	return layout.slice(0, DESK_LAYOUT_MAX_PANELS);
}

function submitMessage() {
	if (!session || !inputValue.trim() || session.isBusy) return;
	// Flushes every panel's pending context first: the turn carries the edit made a moment ago.
	const { entries, omitted } = serializeForRequest();

	// Log what the model gets — and what it does not. An omission is a fact about this
	// turn the user must be able to see, never a silent drop.
	for (const ctx of entries) {
		appendIOLog({
			source: 'context-read',
			label: `${ctx.panelType}: ${ctx.label}`,
			detail: `${ctx.content.length} chars · ${ctx.contentLevel}${ctx.truncated ? ' · truncated' : ''}${ctx.dirty ? ' · unsaved edits' : ''}`,
		});
	}
	for (const gone of omitted) {
		appendIOLog({
			source: 'context-read',
			level: 'error',
			label: `${gone.label} not sent`,
			detail: gone.reason === 'entry_cap' ? `more than ${CONTEXT_MAX_ENTRIES} panels` : 'token budget',
		});
	}
	appendIOLog({ source: 'progress', label: 'Sending message...' });

	const text = inputValue;
	inputValue = '';

	session.submit(text, {
		...(session.conversationId ? { conversationId: session.conversationId } : {}),
		...(entries.length > 0 ? { panelContext: entries } : {}),
		deskLayout: deskLayout(),
		toolScopes: getEnabledScopes(),
		...(getActiveProviderId() ? { providerId: getActiveProviderId() } : {}),
		...(wsState.active ? { activeWorkspace: { id: wsState.active.id, name: wsState.active.name } } : {}),
	});
}

const chatMenus = $derived<MenuBarMenu[]>([
	{
		label: m.composites_desk_bot_menu_chat(),
		items: [
			{
				label: m.composites_desk_bot_new_conversation(),
				icon: 'i-lucide-plus',
				onSelect: startNewChat,
			},
		],
	},
]);

// svelte-ignore state_referenced_locally
$effect(() => {
	return panelMenus.register(panelId, { menuBar: chatMenus });
});
</script>

<div class="chat-panel-container">
	<!-- Messages area -->
	<div bind:this={scrollContainer} class="chat-messages-area">
		{#if messages.length === 0}
			<div class="chat-empty">
				<span class="i-lucide-message-circle chat-empty-icon"></span>
				<p>{m.composites_desk_bot_empty()}</p>
			</div>
		{:else}
			<div class="chat-messages-list">
				{#each messages as message (message.id)}
					{@const inspectPath = inspectTurnPath('deskbot', session?.conversationId, message)}
					<ChatMessage
						role={message.role as 'user' | 'assistant'}
						parts={message.parts}
						catalogSources={citedCatalogSources(traceOf(message))}
						turnError={(message as { metadata?: { turnError?: TurnError } }).metadata?.turnError}
						inspectHref={inspectPath && localizeHref(inspectPath)}
					/>
					{#if message.role === 'assistant' && session}
						{@const proposal = getProposalForMessage(message)}
						{#if proposal}
							<PlanCard
								{proposal}
								run={session.runFor(proposal.id)}
								streamReady={!isLoading}
								{busy}
								onapprove={() => session?.approve(proposal.id)}
								onreject={() => session?.reject(proposal.id)}
							/>
						{/if}
					{/if}
				{/each}

				{#if isLoading && messages[messages.length - 1]?.role === 'user'}
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
	{#if session?.chat.error}
		<div class="chat-error" role="alert" aria-live="polite">
			<span class="font-medium">{m.ai_chat_error_heading()}</span>
			{errorCopy(lastErrorKind)}
			{#if lastErrorKind === 'limit_exceeded'}
				<button class="chat-error-action" type="button" onclick={() => openManagerToTab('storage')}>
					{m.composites_desk_bot_manage_storage()}
				</button>
			{/if}
		</div>
	{/if}

	<!-- Input -->
	<ChatInput
		bind:value={inputValue}
		loading={busy}
		contextCount={activeContextCount}
		onsubmit={submitMessage}
		onstop={isLoading ? () => session?.stop() : undefined}
		onopensettings={() => openManagerToTab()}
	/>

	<!-- Bot Manager Dialog -->
	<BotManagerDialog bind:open={managerOpen} initialTab={managerInitialTab} />
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

	.chat-error-action {
		display: inline;
		margin-left: 4px;
		padding: 0;
		border: none;
		background: none;
		color: var(--color-error-fg, #ef4444);
		font-size: 12px;
		font-weight: 600;
		text-decoration: underline;
		cursor: pointer;
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
