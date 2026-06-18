<script lang="ts">
import { Cluster } from '$lib/components/layout';
import type { UsageVolumeDay } from '$lib/schemas/admin/model-usage';

/**
 * SSR bar chart for a daily count series. The bars are decorative (mouse-only); the
 * `.sr-only` data table is the accessible truth equivalent. Shared by the Usage and
 * Cost admin tabs. Caller wraps it in a Card + header.
 */
let { data, caption, unit }: { data: UsageVolumeDay[]; caption: string; unit: string } = $props();

const maxCount = $derived(data.length ? Math.max(...data.map((d) => d.count)) : 0);
</script>

<div class="volume-chart" aria-hidden="true">
	{#each data as day (day.date)}
		<div class="volume-bar-wrap" title="{day.date}: {day.count} {unit}">
			<div class="volume-bar" style="height: {maxCount > 0 ? (day.count / maxCount) * 100 : 0}%"></div>
		</div>
	{/each}
</div>
<Cluster justify="between">
	<span class="chart-label">{data[0]?.date ?? ''}</span>
	<span class="chart-label">{data[data.length - 1]?.date ?? ''}</span>
</Cluster>

<!-- Text equivalent of the bar chart (the bars are decorative/mouse-only). -->
<table class="sr-only">
	<caption>{caption}</caption>
	<thead>
		<tr><th>Date</th><th>{unit}</th></tr>
	</thead>
	<tbody>
		{#each data as day (day.date)}
			<tr><td>{day.date}</td><td>{day.count}</td></tr>
		{/each}
	</tbody>
</table>

<style>
	.volume-chart {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 120px;
		padding: var(--spacing-2) 0;
	}

	.volume-bar-wrap {
		flex: 1;
		height: 100%;
		display: flex;
		align-items: flex-end;
	}

	.volume-bar {
		width: 100%;
		min-height: 2px;
		background: var(--color-primary);
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		transition: height 0.2s ease;
	}

	.volume-bar-wrap:hover .volume-bar {
		opacity: 0.8;
	}

	.chart-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.volume-bar {
			transition: none;
		}
	}
</style>
