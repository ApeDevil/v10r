<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';
	import { Card } from '$lib/components/composites';

	interface Props {
		title: string;
		description?: string;
		details?: string;
		chart: Snippet;
		class?: string;
	}

	let { title, description, details, chart, class: className }: Props = $props();
</script>

<Card class={cn('chart-section', className)}>
	{#snippet header()}
		<h3 class="chart-title">{title}</h3>
		{#if description}
			<p class="chart-description">{description}</p>
		{/if}
	{/snippet}

	{#snippet children()}
		{@render chart()}
	{/snippet}

	{#snippet footer()}
		{#if details}
			<details class="chart-details">
				<summary>How this works</summary>
				<p>{details}</p>
			</details>
		{/if}
	{/snippet}
</Card>

<style>
	.chart-title {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		margin: 0;
		color: var(--color-fg);
	}

	.chart-description {
		margin: var(--spacing-1) 0 0 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.chart-details {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.chart-details summary {
		cursor: pointer;
		font-weight: 500;
		color: var(--color-fg);
	}

	.chart-details p {
		margin: var(--spacing-3) 0 0 0;
		line-height: 1.6;
	}
</style>
