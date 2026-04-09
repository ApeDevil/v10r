<script lang="ts">
import type { ChartData } from 'chart.js';
import { invalidateAll } from '$app/navigation';
import { Alert, Card, DiagGrid, DiagRow, EmptyState } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Button, Skeleton, Tag } from '$lib/components/primitives';
import LineChart from '$lib/components/viz/chart/line/LineChart.svelte';
import type { PageProps } from './$types';

let { data }: PageProps = $props();

// Consent rate as percentage
const totalSessions = $derived(data.consentSplit.reduce((sum, s) => sum + Number(s.count), 0));
const consentedSessions = $derived(
	data.consentSplit
		.filter((s) => s.tier === 'analytics' || s.tier === 'full')
		.reduce((sum, s) => sum + Number(s.count), 0),
);
const consentRate = $derived(totalSessions > 0 ? Math.round((consentedSessions / totalSessions) * 100) : 0);

function formatNumber(n: number): string {
	return n.toLocaleString();
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	return `${m}m ${s % 60}s`;
}

function buildChartData(trend: typeof data.trend extends Promise<infer T> ? T : never): ChartData<'line'> {
	return {
		labels: trend.map((t) => t.date),
		datasets: [
			{
				label: 'Pageviews',
				data: trend.map((t) => Number(t.pageviews)),
				borderColor: 'primary',
				backgroundColor: 'primary/20',
				fill: true,
				tension: 0.3,
			},
			{
				label: 'Unique Visitors',
				data: trend.map((t) => Number(t.uniqueVisitors)),
				borderColor: 'accent',
				backgroundColor: 'accent/20',
				fill: false,
				tension: 0.3,
			},
		],
	};
}

const ranges = [
	{ value: '7', label: '7d' },
	{ value: '30', label: '30d' },
	{ value: '90', label: '90d' },
];
</script>

<svelte:head>
	<title>Analytics - Admin - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<!-- Headline Stats -->
	<div class="stat-grid">
		<div class="stat-card">
			<span class="stat-label">Pageviews ({data.range}d)</span>
			<span class="stat-value">{formatNumber(data.overview.totalPageviews)}</span>
		</div>
		<div class="stat-card">
			<span class="stat-label">Unique Visitors ({data.range}d)</span>
			<span class="stat-value">{formatNumber(data.overview.uniqueVisitors)}</span>
		</div>
		<div class="stat-card">
			<span class="stat-label">Avg Duration</span>
			<span class="stat-value">{formatDuration(data.overview.avgSessionDuration)}</span>
		</div>
		<div class="stat-card">
			<span class="stat-label">Consent Rate</span>
			<span class="stat-value">
				{consentRate}%
				{#if consentRate < 40}
					<Tag variant="error" label="Low" />
				{:else if consentRate < 60}
					<Tag variant="warning" label="Moderate" />
				{/if}
			</span>
		</div>
	</div>

	<!-- Consent caveat -->
	{#if totalSessions > 0}
		<p class="consent-caveat">
			<span class="i-lucide-info caveat-icon" aria-hidden="true"></span>
			Counts reflect consented sessions only. {consentRate}% of {formatNumber(totalSessions)} sessions have analytics consent.
		</p>
	{/if}

	<!-- Range selector -->
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">Traffic Trend</h2>
				<div class="filter-bar">
					{#each ranges as r}
						<a
							href="/admin/analytics?range={r.value}"
							class="filter-link"
							class:active={data.range === r.value}
						>{r.label}</a>
					{/each}
				</div>
			</Cluster>
		{/snippet}

		{#await data.trend}
			<div class="chart-skeleton">
				<Skeleton variant="rectangular" height="300px" />
			</div>
		{:then trend}
			{#if trend.length === 0}
				<EmptyState
					icon="i-lucide-bar-chart-2"
					title="No data for this period"
					description="Try a wider date range."
				>
					{#if data.range !== '90'}
						<a href="/admin/analytics?range=90" class="text-primary hover:underline text-fluid-sm">
							Try 90 days
						</a>
					{/if}
				</EmptyState>
			{:else}
				<LineChart
					data={buildChartData(trend)}
					ariaLabel="Pageview trend for the last {data.range} days"
				/>
			{/if}
		{:catch}
			<Alert
				variant="error"
				title="Failed to load trend data"
				description="Could not fetch traffic trend."
			>
				<Button variant="outline" size="sm" onclick={() => invalidateAll()}>Try again</Button>
			</Alert>
		{/await}
	</Card>

	<!-- Bottom two-column: Top Pages + Consent Breakdown -->
	<div class="bottom-grid">
		<!-- Top Pages -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Top Pages</h2>
			{/snippet}

			{#await data.topPages}
				<div class="flex flex-col gap-2">
					{#each Array(5) as _}
						<Skeleton variant="text" height="1.5rem" />
					{/each}
				</div>
			{:then pages}
				{#if pages.length === 0}
					<p class="text-muted text-fluid-sm">No page data available.</p>
				{:else}
					{@const maxViews = Math.max(...pages.map((p) => Number(p.pageviews)))}
					<div class="top-pages">
						{#each pages as page, i}
							<div class="top-page-row">
								<span class="top-page-rank">{i + 1}</span>
								<div class="top-page-info">
									<code class="top-page-path">{page.path}</code>
									<div class="top-page-bar" style="width: {(Number(page.pageviews) / maxViews) * 100}%"></div>
								</div>
								<span class="top-page-views">{formatNumber(Number(page.pageviews))}</span>
							</div>
						{/each}
					</div>
				{/if}
			{:catch}
				<Alert
					variant="error"
					title="Failed to load top pages"
					description="Could not fetch page data."
				>
					<Button variant="outline" size="sm" onclick={() => invalidateAll()}>Try again</Button>
				</Alert>
			{/await}
		</Card>

		<!-- Consent Breakdown -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Consent Breakdown</h2>
			{/snippet}

			{#if data.consentSplit.length === 0}
				<p class="text-muted text-fluid-sm">No session data available.</p>
			{:else}
				<DiagGrid>
					{#each data.consentSplit as split}
						{@const pct = totalSessions > 0 ? Math.round((Number(split.count) / totalSessions) * 100) : 0}
						<DiagRow label={split.tier || 'none'}>
							{formatNumber(Number(split.count))}
							<span class="text-muted text-fluid-xs">({pct}%)</span>
						</DiagRow>
					{/each}
				</DiagGrid>
			{/if}
		</Card>
	</div>
</Stack>

<style>
	/* Stat cards grid */
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--spacing-4);
	}

	@media (max-width: 640px) {
		.stat-grid {
			grid-template-columns: 1fr;
		}
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.stat-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.stat-value {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-xl);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	/* Consent caveat */
	.consent-caveat {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		margin: 0;
	}

	.caveat-icon {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	/* Filter bar (same as jobs) */
	.filter-bar {
		display: flex;
		gap: var(--spacing-1);
	}

	.filter-link {
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-sm);
		font-size: var(--text-fluid-xs);
		font-family: ui-monospace, monospace;
		color: var(--color-muted);
		text-decoration: none;
	}

	.filter-link:hover {
		background: var(--color-subtle);
		color: var(--color-fg);
	}

	.filter-link.active {
		background: var(--color-fg);
		color: var(--color-bg);
	}

	/* Chart skeleton */
	.chart-skeleton {
		min-height: 300px;
	}

	/* Bottom grid */
	.bottom-grid {
		display: grid;
		grid-template-columns: 1.5fr 1fr;
		gap: var(--spacing-6);
	}

	@media (max-width: 768px) {
		.bottom-grid {
			grid-template-columns: 1fr;
		}
	}

	/* Top pages */
	.top-pages {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.top-page-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
	}

	.top-page-rank {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		width: 1.5rem;
		text-align: right;
		flex-shrink: 0;
	}

	.top-page-info {
		flex: 1;
		min-width: 0;
		position: relative;
	}

	.top-page-path {
		font-size: var(--text-fluid-sm);
		font-family: ui-monospace, monospace;
		position: relative;
		z-index: 1;
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.top-page-bar {
		position: absolute;
		inset: 0;
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		border-radius: var(--radius-sm);
	}

	.top-page-views {
		font-size: var(--text-fluid-sm);
		font-variant-numeric: tabular-nums;
		color: var(--color-muted);
		flex-shrink: 0;
	}
</style>
