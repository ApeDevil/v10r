<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		title: string;
		description?: string;
		details?: string;
		chart: Snippet;
		class?: string;
	}

	let { title, description, details, chart, class: className }: Props = $props();
</script>

<section class={cn('chart-section', className)}>
	<div class="chart-header">
		<h3 class="chart-title">{title}</h3>
		{#if description}
			<p class="chart-description">{description}</p>
		{/if}
	</div>

	<div class="chart-body">
		{@render chart()}
	</div>

	{#if details}
		<details class="chart-details">
			<summary>How this works</summary>
			<p>{details}</p>
		</details>
	{/if}
</section>

<style>
	.chart-section {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
		overflow: hidden;
	}

	.chart-header {
		padding: var(--spacing-5) var(--spacing-6);
		border-bottom: 1px solid var(--color-border);
	}

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

	.chart-body {
		padding: var(--spacing-6);
	}

	.chart-details {
		border-top: 1px solid var(--color-border);
		padding: var(--spacing-4) var(--spacing-6);
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
