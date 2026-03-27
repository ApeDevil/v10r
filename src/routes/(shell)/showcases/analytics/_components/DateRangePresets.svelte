<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { cn } from '$lib/utils/cn';

interface Props {
	defaultRange?: '7' | '30' | '90';
	class?: string;
}

let { defaultRange = '30', class: className }: Props = $props();

const presets = [
	{ label: '7d', value: '7' },
	{ label: '30d', value: '30' },
	{ label: '90d', value: '90' },
] as const;

const activeRange = $derived(page.url.searchParams.get('range') ?? defaultRange);

function selectRange(value: string) {
	const url = new URL(page.url);
	url.searchParams.set('range', value);
	goto(url.toString(), { replaceState: true, noScroll: true });
}
</script>

<div class={cn('range-presets', className)} role="radiogroup" aria-label="Date range">
	{#each presets as preset}
		<button
			role="radio"
			aria-checked={activeRange === preset.value}
			class="range-chip"
			class:active={activeRange === preset.value}
			onclick={() => selectRange(preset.value)}
		>
			{preset.label}
		</button>
	{/each}
</div>

<style>
	.range-presets {
		display: flex;
		gap: var(--spacing-2);
	}

	.range-chip {
		padding: var(--spacing-1) var(--spacing-4);
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-muted);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-full);
		background: transparent;
		cursor: pointer;
		transition: color var(--duration-fast), background var(--duration-fast),
			border-color var(--duration-fast);
	}

	.range-chip:hover {
		color: var(--color-fg);
		border-color: var(--color-fg);
	}

	.range-chip.active {
		color: var(--color-on-primary-container);
		background: var(--color-primary);
		border-color: var(--color-primary);
	}

	.range-chip:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
