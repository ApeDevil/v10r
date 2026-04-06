<script lang="ts">
	import type { ContextChip } from '$lib/components/composites/dock';

	interface Props {
		chips: ContextChip[];
		totalTokens: number;
		budget?: number;
		/** Cumulative conversation token usage (input + output from AI responses). */
		conversationTokens?: number;
		onpin: (panelId: string) => void;
		onunpin: (panelId: string) => void;
		ondismiss: (panelId: string) => void;
	}

	let { chips, totalTokens, budget = 8000, conversationTokens = 0, onpin, onunpin, ondismiss }: Props = $props();

	const fillPercent = $derived(Math.min(100, Math.round((totalTokens / budget) * 100)));
	const fillLevel = $derived<'normal' | 'warning' | 'error'>(
		fillPercent >= 90 ? 'error' : fillPercent >= 70 ? 'warning' : 'normal',
	);

	const activeChips = $derived(chips.filter((c) => c.status !== 'available'));

	function formatTokens(n: number): string {
		if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
		return String(n);
	}

	/** Icon class for panel type */
	function panelIcon(panelType: string): string {
		switch (panelType) {
			case 'spreadsheet': return 'i-lucide-sheet';
			case 'editor': return 'i-lucide-file-text';
			case 'explorer': return 'i-lucide-folder-tree';
			case 'preview': return 'i-lucide-eye';
			default: return 'i-lucide-layout-grid';
		}
	}
</script>

{#if chips.length > 0}
	<div class="context-tray" role="region" aria-label="AI context">
		<!-- Chips row -->
		<div class="context-chips">
			{#each chips as chip (chip.context.panelId)}
				{#if chip.status === 'available'}
					<!-- Available: click to pin -->
					<button
						type="button"
						class="context-chip available"
						aria-label="{chip.context.label} — click to include"
						onclick={() => onpin(chip.context.panelId)}
					>
						<span class={panelIcon(chip.context.panelType)} style="font-size: 12px;"></span>
						<span class="chip-label">{chip.context.label}</span>
					</button>
				{:else}
					<!-- Implicit or Pinned: active chip -->
					<div
						class="context-chip"
						class:implicit={chip.status === 'implicit'}
						class:pinned={chip.status === 'pinned'}
						aria-label="{chip.context.label}, {chip.status} — included in next message"
					>
						{#if chip.stale}
							<span class="stale-dot" aria-label="Context changed since last response">●</span>
						{/if}
						<span class={panelIcon(chip.context.panelType)} style="font-size: 12px;"></span>
						<span class="chip-label">{chip.context.label}</span>

						{#if chip.status === 'implicit'}
							<button
								type="button"
								class="chip-action"
								aria-label="Pin {chip.context.label} to context"
								onclick={() => onpin(chip.context.panelId)}
							>
								<span class="i-lucide-pin" style="font-size: 10px;"></span>
							</button>
						{:else}
							<button
								type="button"
								class="chip-action"
								aria-label="Unpin {chip.context.label} from context"
								onclick={() => onunpin(chip.context.panelId)}
							>
								<span class="i-lucide-pin-off" style="font-size: 10px;"></span>
							</button>
						{/if}
						<button
							type="button"
							class="chip-action"
							aria-label="Remove {chip.context.label} from context"
							onclick={() => ondismiss(chip.context.panelId)}
						>
							<span class="i-lucide-x" style="font-size: 10px;"></span>
						</button>
					</div>
				{/if}
			{/each}
		</div>

		<!-- Token budget bar (only if there are active entries) -->
		{#if activeChips.length > 0}
			<div class="token-bar-row">
				<div
					class="token-bar"
					role="progressbar"
					aria-valuenow={fillPercent}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-label="Context token usage"
				>
					<div class="token-fill" class:warning={fillLevel === 'warning'} class:error={fillLevel === 'error'} style="width: {fillPercent}%"></div>
				</div>
				<span class="token-label" class:warning={fillLevel === 'warning'} class:error={fillLevel === 'error'}>
					~{formatTokens(totalTokens)} / {formatTokens(budget)} tokens
				</span>
				{#if conversationTokens > 0}
					<span class="conv-tokens" aria-label="Total tokens used in this conversation">
						<span class="i-lucide-zap" style="font-size: 10px;"></span>
						{formatTokens(conversationTokens)} used
					</span>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.context-tray {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 6px 12px;
		border-top: 1px solid var(--color-border);
		background: var(--surface-1);
	}

	.context-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.context-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		height: 26px;
		border-radius: var(--radius-sm);
		font-size: 11px;
		position: relative;
	}

	.context-chip.implicit,
	.context-chip.pinned {
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
		color: var(--color-fg);
	}

	.context-chip.pinned {
		background: transparent;
	}

	.context-chip.available {
		background: color-mix(in srgb, var(--color-muted) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
		color: var(--color-muted);
		opacity: 0.7;
		cursor: pointer;
	}

	.context-chip.available:hover {
		opacity: 1;
	}

	.chip-label {
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chip-action {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: var(--radius-sm);
		color: var(--color-muted);
		cursor: pointer;
		background: none;
		border: none;
		padding: 0;
	}

	.chip-action:hover {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-muted) 15%, transparent);
	}

	.stale-dot {
		position: absolute;
		top: -2px;
		right: -2px;
		font-size: 8px;
		line-height: 1;
		color: var(--color-warning, #f59e0b);
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

	.conv-tokens {
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: 10px;
		color: var(--color-muted);
		margin-left: auto;
	}
</style>
