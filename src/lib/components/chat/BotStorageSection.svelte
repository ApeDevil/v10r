<script lang="ts">
import {
	deleteConversations,
	deleteSingleConversation,
	fetchConversationStorage,
	getStorageState,
} from '$lib/components/composites/dock';
import { Spinner } from '$lib/components/primitives';
import Button from '$lib/components/primitives/button/Button.svelte';

const storage = $derived(getStorageState());
const fillPercent = $derived(storage.meta?.usagePercent ?? 0);
const fillLevel = $derived<'normal' | 'warning' | 'error'>(
	fillPercent >= 90 ? 'error' : fillPercent >= 70 ? 'warning' : 'normal',
);
const isFull = $derived(storage.meta !== null && storage.meta.total >= storage.meta.limit);

let pruneCount = $state(10);
let pruneConfirming = $state(false);
let deleteAllConfirming = $state(false);
let deleteAllCountdown = $state(0);
let countdownTimer: ReturnType<typeof setInterval> | null = null;

// Fetch on first render
$effect(() => {
	if (storage.conversations.length === 0 && !storage.loading && storage.meta === null) {
		fetchConversationStorage();
	}
});

function formatTokens(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
	return String(n);
}

function relativeDate(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60_000);
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	return `${Math.floor(days / 30)}mo ago`;
}

async function handlePrune() {
	if (!pruneConfirming) {
		pruneConfirming = true;
		return;
	}
	pruneConfirming = false;
	const ids = storage.conversations.slice(0, pruneCount).map((c) => c.id);
	await deleteConversations(ids);
}

function cancelPrune() {
	pruneConfirming = false;
}

function startDeleteAll() {
	deleteAllConfirming = true;
	deleteAllCountdown = 5;
	countdownTimer = setInterval(() => {
		deleteAllCountdown--;
		if (deleteAllCountdown <= 0) {
			clearInterval(countdownTimer!);
			countdownTimer = null;
			executeDeleteAll();
		}
	}, 1000);
}

function cancelDeleteAll() {
	deleteAllConfirming = false;
	deleteAllCountdown = 0;
	if (countdownTimer) {
		clearInterval(countdownTimer);
		countdownTimer = null;
	}
}

async function executeDeleteAll() {
	deleteAllConfirming = false;
	const ids = storage.conversations.map((c) => c.id);
	await deleteConversations(ids);
}
</script>

<div class="storage-section">
	{#if storage.loading && storage.meta === null}
		<div class="loading-state">
			<Spinner size="sm" />
			<span>Loading storage...</span>
		</div>
	{:else if storage.error && storage.meta === null}
		<div class="error-state">
			<span class="i-lucide-alert-triangle" style="font-size: 16px;"></span>
			<span>{storage.error}</span>
		</div>
	{:else}
		<!-- Usage bar -->
		{#if storage.meta}
			<div class="usage-bar-row">
				<div
					class="usage-bar"
					role="progressbar"
					aria-valuenow={storage.meta.total}
					aria-valuemin={0}
					aria-valuemax={storage.meta.limit}
					aria-label="Conversation storage usage"
				>
					<div
						class="usage-fill"
						class:warning={fillLevel === 'warning'}
						class:error={fillLevel === 'error'}
						style="width: {fillPercent}%"
					></div>
				</div>
				<span class="usage-label" class:warning={fillLevel === 'warning'} class:error={fillLevel === 'error'}>
					{storage.meta.total} / {storage.meta.limit} conversations
				</span>
			</div>

			{#if isFull}
				<div class="warning-strip" role="alert">
					Limit reached. Delete conversations to start new chats.
				</div>
			{/if}
		{/if}

		{#if storage.conversations.length === 0}
			<div class="empty-state">
				<span class="i-lucide-archive empty-icon"></span>
				<p>No conversations yet. Start chatting to see your history here.</p>
			</div>
		{:else}
			<!-- Quick prune -->
			<div class="scope-group">
				<div class="group-header">Quick cleanup</div>
				<div class="prune-row">
					<span class="prune-label">Delete oldest</span>
					<select class="prune-select" bind:value={pruneCount} disabled={pruneConfirming}>
						<option value={10}>10</option>
						<option value={25}>25</option>
						<option value={50}>50</option>
					</select>
					{#if !pruneConfirming}
						<Button variant="ghost" size="sm" onclick={handlePrune}>
							{#snippet children()}Delete{/snippet}
						</Button>
					{/if}
				</div>
				{#if pruneConfirming}
					<div class="confirm-strip" role="alert">
						<span class="confirm-text">Delete {Math.min(pruneCount, storage.conversations.length)} oldest conversations?</span>
						<div class="confirm-actions">
							<Button variant="ghost" size="sm" onclick={cancelPrune}>
								{#snippet children()}Cancel{/snippet}
							</Button>
							<Button variant="primary" size="sm" onclick={handlePrune}>
								{#snippet children()}Confirm{/snippet}
							</Button>
						</div>
					</div>
				{/if}
			</div>

			<!-- Conversation list -->
			<div class="scope-group">
				<div class="group-header">Conversations ({storage.conversations.length})</div>
				<div class="conversation-list" role="list" aria-label="Conversations">
					{#each storage.conversations as conv (conv.id)}
						{@const isDeleting = storage.deleting.has(conv.id)}
						<div class="conv-row" class:deleting={isDeleting} role="listitem">
							<div class="conv-info">
								<span class="conv-title">{conv.title ?? 'Untitled'}</span>
								<span class="conv-meta">
									{relativeDate(conv.createdAt)} · {formatTokens(conv.totalTokens)} tokens
								</span>
							</div>
							<button
								class="conv-delete"
								type="button"
								disabled={isDeleting}
								onclick={() => deleteSingleConversation(conv.id)}
								aria-label="Delete {conv.title ?? 'conversation'}"
							>
								<span class="i-lucide-trash-2" style="font-size: 14px;"></span>
							</button>
						</div>
					{/each}
				</div>
			</div>

			<!-- Delete all -->
			{#if !deleteAllConfirming}
				<button class="delete-all-link" type="button" onclick={startDeleteAll}>
					Delete all conversations
				</button>
			{:else}
				<div class="confirm-strip danger" role="alert">
					<span class="confirm-text">Deleting all conversations in {deleteAllCountdown}s...</span>
					<div class="confirm-actions">
						<Button variant="ghost" size="sm" onclick={cancelDeleteAll}>
							{#snippet children()}Cancel{/snippet}
						</Button>
					</div>
				</div>
			{/if}
		{/if}
	{/if}
</div>

<style>
	.storage-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 4px 0;
	}

	.loading-state,
	.error-state {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 24px 16px;
		font-size: 12px;
		color: var(--color-muted);
	}

	.error-state {
		color: var(--color-error-fg, #ef4444);
	}

	/* Usage bar — matches Context tab token bar */
	.usage-bar-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.usage-bar {
		flex: 1;
		height: 3px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--color-muted) 15%, transparent);
		overflow: hidden;
	}

	.usage-fill {
		height: 100%;
		border-radius: 2px;
		background: color-mix(in srgb, var(--color-primary) 40%, transparent);
		transition: width 0.3s ease;
	}

	.usage-fill.warning {
		background: color-mix(in srgb, var(--color-warning, #f59e0b) 60%, transparent);
	}

	.usage-fill.error {
		background: color-mix(in srgb, var(--color-error-fg, #ef4444) 70%, transparent);
	}

	.usage-label {
		font-size: 10px;
		color: var(--color-muted);
		white-space: nowrap;
	}

	.usage-label.warning {
		color: var(--color-warning, #f59e0b);
	}

	.usage-label.error {
		color: var(--color-error-fg, #ef4444);
	}

	.warning-strip {
		padding: 8px 12px;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-warning, #f59e0b) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-warning, #f59e0b) 20%, transparent);
		font-size: 12px;
		color: var(--color-warning, #f59e0b);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 24px 16px;
		text-align: center;
		color: var(--color-muted);
		font-size: 12px;
	}

	.empty-icon {
		font-size: 24px;
		opacity: 0.4;
	}

	/* Group headers — matches BotToolsSection */
	.scope-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.group-header {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
		padding-bottom: 4px;
		border-bottom: 1px solid var(--color-border);
	}

	/* Quick prune */
	.prune-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 0;
	}

	.prune-label {
		font-size: 13px;
		color: var(--color-fg);
	}

	.prune-select {
		padding: 2px 6px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-fg);
		font-size: 12px;
	}

	/* Confirm strip — matches BotToolsSection */
	.confirm-strip {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 8px 12px;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-warning, #f59e0b) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-warning, #f59e0b) 20%, transparent);
	}

	.confirm-strip.danger {
		background: color-mix(in srgb, var(--color-error-fg, #ef4444) 8%, transparent);
		border-color: color-mix(in srgb, var(--color-error-fg, #ef4444) 20%, transparent);
	}

	.confirm-text {
		font-size: 12px;
		color: var(--color-warning, #f59e0b);
	}

	.confirm-strip.danger .confirm-text {
		color: var(--color-error-fg, #ef4444);
	}

	.confirm-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	/* Conversation list */
	.conversation-list {
		max-height: 280px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.conv-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 4px;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
		transition: opacity 150ms ease;
	}

	.conv-row.deleting {
		opacity: 0.4;
		pointer-events: none;
	}

	.conv-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
		flex: 1;
	}

	.conv-title {
		font-size: 13px;
		font-weight: 500;
		color: var(--color-fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.conv-meta {
		font-size: 11px;
		color: var(--color-muted);
	}

	.conv-delete {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
		flex-shrink: 0;
	}

	.conv-delete:hover {
		color: var(--color-error-fg, #ef4444);
		background: color-mix(in srgb, var(--color-error-fg, #ef4444) 8%, transparent);
	}

	/* Delete all */
	.delete-all-link {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 0;
		border: none;
		background: none;
		font-size: 12px;
		color: var(--color-error-fg, #ef4444);
		cursor: pointer;
	}

	.delete-all-link:hover {
		text-decoration: underline;
	}
</style>
