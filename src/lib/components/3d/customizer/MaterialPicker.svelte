<script lang="ts">
	import type { MaterialGroup } from '$lib/config/customization';

	interface Props {
		group: MaterialGroup;
		selectedId: string;
		disabledIds?: Set<string>;
		onselect: (optionId: string) => void;
	}

	let { group, selectedId, disabledIds, onselect }: Props = $props();
</script>

<fieldset class="material-picker">
	<legend class="picker-label">{group.label}</legend>
	<div class="swatch-grid" role="radiogroup" aria-label={group.label}>
		{#each group.options as option (option.id)}
			{@const isDisabled = disabledIds?.has(option.id) ?? false}
			{@const isSelected = selectedId === option.id}
			<button
				class="swatch"
				class:selected={isSelected}
				disabled={isDisabled}
				aria-label={option.label}
				aria-checked={isSelected}
				role="radio"
				title={option.label}
				onclick={() => onselect(option.id)}
			>
				<span class="swatch-color" style:background-color={option.color}></span>
				{#if isSelected}
					<span class="check i-lucide-check" aria-hidden="true"></span>
				{/if}
			</button>
		{/each}
	</div>
</fieldset>

<style>
	.material-picker {
		border: none;
		padding: 0;
		margin: 0;
	}

	.picker-label {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-fg);
		margin-bottom: var(--spacing-2);
	}

	.swatch-grid {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
	}

	.swatch {
		position: relative;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-full);
		border: 2px solid transparent;
		padding: 2px;
		background: none;
		cursor: pointer;
		transition: border-color var(--duration-fast);
	}

	.swatch:hover:not(:disabled) {
		border-color: var(--color-muted);
	}

	.swatch.selected {
		border-color: var(--color-primary);
	}

	.swatch:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.swatch:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.swatch-color {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: var(--radius-full);
		border: 1px solid color-mix(in srgb, var(--color-fg) 15%, transparent);
	}

	.check {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-size: 14px;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
	}
</style>
