<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { FunnelStep } from '$lib/server/analytics/types';

	interface Props {
		steps: FunnelStep[];
		class?: string;
	}

	let { steps, class: className }: Props = $props();

	const maxCount = $derived(steps[0]?.count ?? 1);
</script>

<div class={cn('funnel', className)} role="img" aria-label="Conversion funnel">
	{#each steps as step, i}
		{@const width = maxCount > 0 ? (step.count / maxCount) * 100 : 0}
		{@const dropoff = i > 0 ? steps[i - 1].count - step.count : 0}
		{@const dropoffPct = i > 0 && steps[i - 1].count > 0 ? Math.round((dropoff / steps[i - 1].count) * 100) : 0}

		<div class="funnel-row">
			<div class="funnel-label">
				<span class="funnel-step-name">{step.label}</span>
				<span class="funnel-step-path">{step.path}</span>
			</div>

			<div class="funnel-bar-container">
				<div class="funnel-bar" style="width: {width}%">
					<span class="funnel-count">{step.count.toLocaleString()}</span>
				</div>
			</div>

			<div class="funnel-meta">
				<span class="funnel-rate">{step.rate}%</span>
				{#if i > 0 && dropoff > 0}
					<span class="funnel-dropoff">-{dropoffPct}%</span>
				{/if}
			</div>
		</div>
	{/each}
</div>

<style>
	.funnel {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.funnel-row {
		display: grid;
		grid-template-columns: 140px 1fr 80px;
		gap: var(--spacing-4);
		align-items: center;
	}

	@media (max-width: 640px) {
		.funnel-row {
			grid-template-columns: 1fr;
			gap: var(--spacing-1);
		}
	}

	.funnel-label {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.funnel-step-name {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
	}

	.funnel-step-path {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-family: 'Fira Code', monospace;
	}

	.funnel-bar-container {
		width: 100%;
		height: 32px;
		border-radius: var(--radius-md);
		background: var(--color-subtle);
		overflow: hidden;
	}

	.funnel-bar {
		height: 100%;
		background: var(--color-primary);
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		padding-left: var(--spacing-3);
		min-width: 40px;
		transition: width var(--duration-normal);
	}

	.funnel-count {
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		color: var(--color-primary-fg);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.funnel-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 1px;
	}

	.funnel-rate {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
		font-variant-numeric: tabular-nums;
	}

	.funnel-dropoff {
		font-size: var(--text-fluid-xs);
		color: var(--color-error);
		font-variant-numeric: tabular-nums;
	}
</style>
