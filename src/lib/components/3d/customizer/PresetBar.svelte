<script lang="ts">
import type { CustomizationPreset } from '$lib/config/customization';

interface Props {
	presets: CustomizationPreset[];
	activeId?: string;
	onselect: (preset: CustomizationPreset) => void;
}

let { presets, activeId, onselect }: Props = $props();
</script>

<div class="preset-bar" role="group" aria-label="Presets">
	{#each presets as preset (preset.id)}
		<button
			class="preset-card"
			class:active={activeId === preset.id}
			aria-pressed={activeId === preset.id}
			onclick={() => onselect(preset)}
		>
			{preset.label}
		</button>
	{/each}
</div>

<style>
	.preset-bar {
		display: flex;
		gap: var(--spacing-2);
		overflow-x: auto;
		scrollbar-width: none;
		padding: var(--spacing-1) 0;
	}

	.preset-bar::-webkit-scrollbar {
		display: none;
	}

	.preset-card {
		flex-shrink: 0;
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-fg) 3%, transparent);
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
		font-weight: 400;
		cursor: pointer;
		transition: border-color var(--duration-fast), background var(--duration-fast);
		white-space: nowrap;
	}

	.preset-card:hover {
		background: color-mix(in srgb, var(--color-fg) 8%, transparent);
	}

	.preset-card.active {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		font-weight: 500;
	}

	.preset-card:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
