<script lang="ts">
import { getContextChips } from '$lib/components/composites/dock';

interface Props {
	onopensettings: () => void;
}

let { onopensettings }: Props = $props();

const chips = $derived(getContextChips());
const activeCount = $derived(chips.filter((c) => c.status !== 'available').length);
</script>

<div class="context-tray">
	{#if activeCount > 0}
		<span class="context-hint">
			<span class="i-lucide-layers" style="font-size: 12px;"></span>
			{activeCount} context{activeCount !== 1 ? 's' : ''} attached
		</span>
	{/if}

	<button
		type="button"
		class="settings-trigger"
		aria-label="AI assistant settings"
		onclick={onopensettings}
	>
		<span class="i-lucide-sliders-horizontal" style="font-size: 14px;"></span>
	</button>
</div>

<style>
	.context-tray {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 12px;
		border-top: 1px solid var(--color-border);
	}

	.context-hint {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: var(--color-muted);
	}

	.settings-trigger {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: var(--radius-sm);
		color: var(--color-muted);
		cursor: pointer;
		background: none;
		border: none;
		padding: 0;
		margin-left: auto;
		flex-shrink: 0;
	}

	.settings-trigger:hover {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-muted) 12%, transparent);
	}
</style>
