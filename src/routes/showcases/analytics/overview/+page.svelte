<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, Card, ConfirmDialog } from '$lib/components/composites';
	import { getToast } from '$lib/state/toast.svelte';
	import { Button } from '$lib/components/primitives';
	import { AreaChart } from '$lib/components/viz/chart/area';
	import { BarChart } from '$lib/components/viz/chart/bar';
	import { PieChart } from '$lib/components/viz/chart/pie';
	import MetricCard from '../_components/MetricCard.svelte';
	import DateRangePresets from '../_components/DateRangePresets.svelte';
	import ChartSection from '../_components/ChartSection.svelte';
	import type { ChartData } from 'chart.js';

	let { data } = $props();
	const toast = getToast();
	let resetDialogOpen = $state(false);

	// Format duration from ms to human readable
	function formatDuration(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		const seconds = Math.floor(ms / 1000);
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		const remaining = seconds % 60;
		return `${minutes}m ${remaining}s`;
	}

	// Sparkline data from trend
	const pageviewSparkline = $derived(data.trend.map((t) => Number(t.pageviews)));
	const visitorSparkline = $derived(data.trend.map((t) => Number(t.uniqueVisitors)));

	// Area chart data for traffic trend
	const trendChartData: ChartData<'line'> = $derived({
		labels: data.trend.map((t) => t.date.slice(5)),
		datasets: [
			{
				label: 'Pageviews',
				data: data.trend.map((t) => Number(t.pageviews)),
				borderColor: 'var(--chart-1)',
				backgroundColor: 'color-mix(in srgb, var(--chart-1) 20%, transparent)',
			},
			{
				label: 'Unique Visitors',
				data: data.trend.map((t) => Number(t.uniqueVisitors)),
				borderColor: 'var(--chart-2)',
				backgroundColor: 'color-mix(in srgb, var(--chart-2) 20%, transparent)',
			},
		],
	});

	// Top pages bar chart
	const topPagesData: ChartData<'bar'> = $derived({
		labels: data.topPages.map((p) => p.path),
		datasets: [
			{
				label: 'Pageviews',
				data: data.topPages.map((p) => Number(p.pageviews)),
				backgroundColor: 'var(--chart-1)',
			},
		],
	});

	// Device pie chart
	const deviceData: ChartData<'pie'> = $derived({
		labels: data.devices.map((d) => d.device),
		datasets: [
			{
				data: data.devices.map((d) => Number(d.count)),
				backgroundColor: [
					'var(--chart-1)',
					'var(--chart-2)',
					'var(--chart-3)',
					'var(--chart-4)',
					'var(--chart-5)',
				],
			},
		],
	});

	// Browser pie chart
	const browserData: ChartData<'pie'> = $derived({
		labels: data.browsers.map((b) => b.browser),
		datasets: [
			{
				data: data.browsers.map((b) => Number(b.count)),
				backgroundColor: [
					'var(--chart-1)',
					'var(--chart-2)',
					'var(--chart-3)',
					'var(--chart-4)',
					'var(--chart-5)',
				],
			},
		],
	});

	// Country bar chart
	const countryData: ChartData<'bar'> = $derived({
		labels: data.countries.slice(0, 10).map((c) => c.country),
		datasets: [
			{
				label: 'Sessions',
				data: data.countries.slice(0, 10).map((c) => Number(c.count)),
				backgroundColor: 'var(--chart-3)',
			},
		],
	});
</script>

{#if data.error}
	<Alert variant="error" title="Database Error">
		<code>{data.error}</code>
		<p class="text-fluid-sm mt-3">Try reseeding the analytics data to create the required tables and data.</p>
	</Alert>
{/if}

<div class="overview-controls">
	<DateRangePresets />
	{#if data.queryMs}
		<span class="query-time">
			<span class="i-lucide-clock text-icon-xs" aria-hidden="true"></span>
			{data.queryMs}ms
		</span>
	{/if}
</div>

<!-- Metric cards -->
<div class="metrics-grid">
	<MetricCard
		title="Total Pageviews"
		value={data.metrics.totalPageviews.toLocaleString()}
		sparklineData={pageviewSparkline}
	/>
	<MetricCard
		title="Unique Visitors"
		value={data.metrics.uniqueVisitors.toLocaleString()}
		sparklineData={visitorSparkline}
	/>
	<MetricCard
		title="Avg Duration"
		value={formatDuration(data.metrics.avgSessionDuration)}
	/>
	<MetricCard
		title="Bounce Rate"
		value="{data.metrics.bounceRate}%"
	/>
</div>

<!-- Traffic trend -->
{#if data.trend.length > 0}
	<ChartSection
		title="Traffic Trend"
		description="Pageviews and unique visitors over time"
		details="Data is aggregated daily from raw pageview events. Each data point represents one day's totals."
	>
		{#snippet chart()}
			<AreaChart data={trendChartData} ariaLabel="Traffic trend over {data.days} days" />
		{/snippet}
	</ChartSection>
{/if}

<!-- Top pages + breakdowns -->
<div class="charts-grid">
	{#if data.topPages.length > 0}
		<ChartSection title="Top Pages" description="Most visited pages by pageview count">
			{#snippet chart()}
				<BarChart data={topPagesData} horizontal ariaLabel="Top pages by pageviews" />
			{/snippet}
		</ChartSection>
	{/if}

	{#if data.devices.length > 0}
		<ChartSection title="Devices" description="Session distribution by device type">
			{#snippet chart()}
				<PieChart data={deviceData} doughnut ariaLabel="Device distribution" aspect="square" />
			{/snippet}
		</ChartSection>
	{/if}

	{#if data.browsers.length > 0}
		<ChartSection title="Browsers" description="Session distribution by browser">
			{#snippet chart()}
				<PieChart data={browserData} doughnut ariaLabel="Browser distribution" aspect="square" />
			{/snippet}
		</ChartSection>
	{/if}

	{#if data.countries.length > 0}
		<ChartSection title="Countries" description="Top 10 countries by session count">
			{#snippet chart()}
				<BarChart data={countryData} horizontal ariaLabel="Country distribution" />
			{/snippet}
		</ChartSection>
	{/if}
</div>

<!-- Reseed controls -->
<div class="reseed-section">
	<Button variant="outline" onclick={() => (resetDialogOpen = true)}>
		<span class="i-lucide-refresh-cw text-icon-sm" aria-hidden="true"></span>
		Reset to Seed Data
	</Button>
</div>

<ConfirmDialog
	bind:open={resetDialogOpen}
	title="Reset Analytics Data"
	description="This will truncate all analytics tables and re-insert synthetic seed data. This action cannot be undone."
	onconfirm={() => {
		const form = document.getElementById('reseed-form') as HTMLFormElement;
		form?.requestSubmit();
	}}
	oncancel={() => (resetDialogOpen = false)}
/>

<form
	id="reseed-form"
	method="POST"
	action="?/reseed"
	class="hidden"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				toast.success('Analytics data reset to seed values.');
			} else {
				toast.error('Failed to reset analytics data.');
			}
			return update();
		};
	}}
>
</form>

<style>
	.overview-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--spacing-6);
	}

	.query-time {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}

	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--spacing-4);
		margin-bottom: var(--spacing-6);
	}

	@media (max-width: 768px) {
		.metrics-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 480px) {
		.metrics-grid {
			grid-template-columns: 1fr;
		}
	}

	.charts-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--spacing-6);
		margin-top: var(--spacing-6);
	}

	@media (max-width: 768px) {
		.charts-grid {
			grid-template-columns: 1fr;
		}
	}

	.reseed-section {
		display: flex;
		justify-content: flex-end;
		margin-top: var(--spacing-7);
		padding-top: var(--spacing-6);
		border-top: 1px solid var(--color-border);
	}
</style>
