<script lang="ts">
import {
	CONTEXT_TOKEN_BUDGET,
	dismissContext,
	getContextChips,
	getTokenEstimate,
	pinContext,
	restoreContext,
} from '$lib/components/composites/dock';
import Switch from '$lib/components/primitives/switch/Switch.svelte';

const chips = $derived(getContextChips());
const totalTokens = $derived(getTokenEstimate());
const budget = CONTEXT_TOKEN_BUDGET;
const fillPercent = $derived(Math.min(100, Math.round((totalTokens / budget) * 100)));
const fillLevel = $derived<'normal' | 'warning' | 'error'>(
	fillPercent >= 90 ? 'error' : fillPercent >= 70 ? 'warning' : 'normal',
);

function formatTokens(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
	return String(n);
}

function panelIcon(panelType: string): string {
	switch (panelType) {
		case 'spreadsheet':
			return 'i-lucide-sheet';
		case 'editor':
			return 'i-lucide-file-text';
		case 'explorer':
			return 'i-lucide-folder-tree';
		case 'preview':
			return 'i-lucide-eye';
		default:
			return 'i-lucide-layout-grid';
	}
}

function handleToggle(panelId: string, status: string, checked: boolean) {
	if (checked) {
		restoreContext(panelId);
		if (status === 'available') {
			pinContext(panelId);
		}
	} else {
		dismissContext(panelId);
	}
}

const TRUNCATE_LINES = 6;

function truncateContent(content: string): { text: string; totalLines: number; truncated: boolean } {
	const lines = content.split('\n');
	const truncated = lines.length > TRUNCATE_LINES;
	return {
		text: truncated ? lines.slice(0, TRUNCATE_LINES).join('\n') : content,
		totalLines: lines.length,
		truncated,
	};
}
</script>

<div class="context-section">
	<!-- Token budget bar -->
	<div class="token-bar-row">
		<div
			class="token-bar"
			role="progressbar"
			aria-valuenow={fillPercent}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-label="Context token usage"
		>
			<div
				class="token-fill"
				class:warning={fillLevel === 'warning'}
				class:error={fillLevel === 'error'}
				style="width: {fillPercent}%"
			></div>
		</div>
		<span class="token-label" class:warning={fillLevel === 'warning'} class:error={fillLevel === 'error'}>
			~{formatTokens(totalTokens)} / {formatTokens(budget)} tokens
		</span>
	</div>

	{#if chips.length === 0}
		<div class="empty-state">
			<span class="i-lucide-layers empty-icon"></span>
			<p>No panels are providing context. Open a spreadsheet or document to get started.</p>
		</div>
	{:else}
		<!-- Context entries with toggles -->
		<div class="context-list">
			{#each chips as chip (chip.context.panelId)}
				{@const isIncluded = chip.status === 'implicit' || chip.status === 'pinned'}
				{@const preview = truncateContent(chip.context.content)}
				<div class="context-entry" class:included={isIncluded}>
					<div class="entry-header">
						<div class="entry-info">
							<span class={panelIcon(chip.context.panelType)} style="font-size: 14px;"></span>
							<span class="entry-label">{chip.context.label}</span>
							{#if chip.status === 'implicit'}
								<span class="status-badge implicit">auto</span>
							{:else if chip.status === 'pinned'}
								<span class="status-badge pinned">pinned</span>
							{/if}
							{#if chip.stale}
								<span class="stale-dot" aria-label="Changed since last response">●</span>
							{/if}
						</div>
						<div class="entry-actions">
							<span class="entry-tokens">~{chip.context.tokenEstimate} tok</span>
							<Switch
								size="sm"
								checked={isIncluded}
								onCheckedChange={(checked) => handleToggle(chip.context.panelId, chip.status, checked)}
							/>
						</div>
					</div>

					<!-- Expandable content preview -->
					<details class="entry-details">
						<summary class="details-trigger">
							<span class="i-lucide-chevron-right chevron-icon"></span>
							Preview
						</summary>
						<pre class="content-preview">{preview.text}</pre>
						{#if preview.truncated}
							<span class="truncation-notice">
								Showing {TRUNCATE_LINES} of {preview.totalLines} lines
							</span>
						{/if}
					</details>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.context-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 4px 0;
	}

	/* Token budget bar */
	.token-bar-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.token-bar {
		flex: 1;
		height: 3px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--color-muted) 15%, transparent);
		overflow: hidden;
	}

	.token-fill {
		height: 100%;
		border-radius: 2px;
		background: color-mix(in srgb, var(--color-primary) 40%, transparent);
		transition: width 0.3s ease;
	}

	.token-fill.warning {
		background: color-mix(in srgb, var(--color-warning, #f59e0b) 60%, transparent);
	}

	.token-fill.error {
		background: color-mix(in srgb, var(--color-error-fg, #ef4444) 70%, transparent);
	}

	.token-label {
		font-size: 10px;
		color: var(--color-muted);
		white-space: nowrap;
	}

	.token-label.warning {
		color: var(--color-warning, #f59e0b);
	}

	.token-label.error {
		color: var(--color-error-fg, #ef4444);
	}

	/* Empty state */
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

	/* Context list */
	.context-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.context-entry {
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		overflow: hidden;
	}

	.context-entry.included {
		border-color: color-mix(in srgb, var(--color-primary) 25%, transparent);
		background: color-mix(in srgb, var(--color-primary) 3%, transparent);
	}

	.entry-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 12px;
	}

	.entry-info {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}

	.entry-label {
		font-size: 13px;
		font-weight: 500;
		color: var(--color-fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.status-badge {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 1px 4px;
		border-radius: var(--radius-sm);
	}

	.status-badge.implicit {
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
		color: var(--color-primary);
	}

	.status-badge.pinned {
		background: color-mix(in srgb, var(--color-muted) 12%, transparent);
		color: var(--color-muted);
	}

	.stale-dot {
		font-size: 8px;
		line-height: 1;
		color: var(--color-warning, #f59e0b);
	}

	.entry-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.entry-tokens {
		font-size: 10px;
		color: var(--color-muted);
		white-space: nowrap;
	}

	/* Expandable details */
	.entry-details {
		border-top: 1px solid var(--color-border);
	}

	.details-trigger {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 12px;
		font-size: 11px;
		color: var(--color-muted);
		cursor: pointer;
		user-select: none;
	}

	.details-trigger:hover {
		color: var(--color-fg);
	}

	.chevron-icon {
		font-size: 12px;
		transition: transform 150ms ease;
	}

	.entry-details[open] .chevron-icon {
		transform: rotate(90deg);
	}

	.content-preview {
		margin: 0;
		padding: 8px 12px;
		font-family: var(--font-mono, monospace);
		font-size: 11px;
		line-height: 1.5;
		color: var(--color-muted);
		white-space: pre-wrap;
		word-break: break-all;
		max-height: 200px;
		overflow-y: auto;
		background: color-mix(in srgb, var(--color-muted) 5%, transparent);
	}

	.truncation-notice {
		display: block;
		padding: 4px 12px 8px;
		font-size: 10px;
		color: var(--color-muted);
		font-style: italic;
	}
</style>
