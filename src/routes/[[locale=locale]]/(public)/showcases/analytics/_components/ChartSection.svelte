<script lang="ts">
import type { Snippet } from 'svelte';
import { Card } from '$lib/components/composites';
import { cn } from '$lib/utils/cn';

interface Props {
	title: string;
	description?: string;
	chart: Snippet;
	class?: string;
}

let { title, description, chart, class: className }: Props = $props();
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
</style>
