<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { Sparkline } from '$lib/components/viz/chart/sparkline';

	interface Props {
		title: string;
		value: number | string;
		delta?: number;
		sparklineData?: number[];
		class?: string;
	}

	let { title, value, delta, sparklineData, class: className }: Props = $props();

	const deltaLabel = $derived(
		delta != null
			? delta > 0
				? `Up ${Math.abs(delta)}%`
				: delta < 0
					? `Down ${Math.abs(delta)}%`
					: 'No change'
			: undefined,
	);
</script>

<div
	class={cn('metric-card', className)}
	role="group"
	aria-label="{title}: {value}{deltaLabel ? `, ${deltaLabel}, vs previous period` : ''}"
>
	<span class="metric-label">{title}</span>
	<span class="metric-value">{value}</span>

	<div class="metric-footer">
		{#if delta != null}
			<span class="metric-delta" class:positive={delta > 0} class:negative={delta < 0}>
				{#if delta > 0}
					<span class="i-lucide-trending-up text-icon-sm" aria-hidden="true"></span>
				{:else if delta < 0}
					<span class="i-lucide-trending-down text-icon-sm" aria-hidden="true"></span>
				{:else}
					<span class="i-lucide-minus text-icon-sm" aria-hidden="true"></span>
				{/if}
				{Math.abs(delta)}%
				<span class="delta-context">vs prev.</span>
			</span>
		{/if}

		{#if sparklineData && sparklineData.length > 1}
			<Sparkline data={sparklineData} type="area" width={80} height={24} ariaLabel="{title} trend" />
		{/if}
	</div>
</div>

<style>
	.metric-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding: var(--spacing-5) var(--spacing-6);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
	}

	.metric-label {
		font-size: var(--text-fluid-xs);
		font-weight: 500;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.metric-value {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		line-height: 1.1;
		color: var(--color-fg);
		font-variant-numeric: tabular-nums;
	}

	.metric-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-3);
		margin-top: var(--spacing-1);
	}

	.metric-delta {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-muted);
	}

	.metric-delta.positive {
		color: var(--color-success);
	}

	.metric-delta.negative {
		color: var(--color-error);
	}

	.delta-context {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-weight: 400;
	}
</style>
