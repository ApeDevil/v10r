<script lang="ts">
import type { ChartData } from 'chart.js';
import { invalidateAll } from '$app/navigation';
import LiveFeed from '$lib/components/admin/LiveFeed.svelte';
import { Alert, Card, DiagGrid, DiagRow, EmptyState } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Button, Skeleton, Tag } from '$lib/components/primitives';
import LineChart from '$lib/components/viz/chart/line/LineChart.svelte';
import * as m from '$lib/paraglide/messages';

let { data }: PageProps = $props();
let pairedActive = $state(data.pairedActive);

// Consent rate as percentage
const totalSessions = $derived(data.consentSplit.reduce((sum, s) => sum + Number(s.count), 0));
const consentedSessions = $derived(
	data.consentSplit
		.filter((s) => s.tier === 'analytics' || s.tier === 'full')
		.reduce((sum, s) => sum + Number(s.count), 0),
);
const consentRate = $derived(totalSessions > 0 ? Math.round((consentedSessions / totalSessions) * 100) : 0);

const HOUR_MS = 60 * 60 * 1000;
const cleanupAgeMs = $derived(
	data.lastCleanup.startedAt ? Date.now() - new Date(data.lastCleanup.startedAt).getTime() : null,
);
const cleanupOverdue = $derived(cleanupAgeMs == null || cleanupAgeMs > 26 * HOUR_MS);

function formatNumber(n: number): string {
	return n.toLocaleString();
}

function formatRelativeAge(ms: number | null): string {
	if (ms == null) return 'never';
	const minutes = Math.round(ms / 60_000);
	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 48) return `${hours}h ago`;
	const days = Math.round(hours / 24);
	return `${days}d ago`;
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	const mins = Math.floor(s / 60);
	return `${mins}m ${s % 60}s`;
}

function buildChartData(trend: typeof data.trend extends Promise<infer T> ? T : never): ChartData<'line'> {
	return {
		labels: trend.map((t) => t.date),
		datasets: [
			{
				label: m.admin_analytics_chart_pageviews(),
				data: trend.map((t) => Number(t.pageviews)),
				borderColor: 'primary',
				backgroundColor: 'primary/20',
				fill: true,
				tension: 0.3,
			},
			{
				label: m.admin_analytics_chart_unique_visitors(),
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
<Stack gap="6">
	<!-- Headline Stats -->
	<div class="stat-grid">
		<div class="stat-card">
			<span class="stat-label">{m.admin_analytics_stat_pageviews({ range: data.range })}</span>
			<span class="stat-value">{formatNumber(data.overview.totalPageviews)}</span>
		</div>
		<div class="stat-card">
			<span class="stat-label">{m.admin_analytics_stat_unique_visitors({ range: data.range })}</span>
			<span class="stat-value">{formatNumber(data.overview.uniqueVisitors)}</span>
		</div>
		<div class="stat-card">
			<span class="stat-label">{m.admin_analytics_stat_avg_duration()}</span>
			<span class="stat-value">{formatDuration(data.overview.avgSessionDuration)}</span>
		</div>
		<div class="stat-card">
			<span class="stat-label">{m.admin_analytics_stat_consent_rate()}</span>
			<span class="stat-value">
				{consentRate}%
				{#if consentRate < 40}
					<Tag variant="error" label={m.admin_analytics_consent_low()} />
				{:else if consentRate < 60}
					<Tag variant="warning" label={m.admin_analytics_consent_moderate()} />
				{/if}
			</span>
		</div>
	</div>

	<!-- Consent caveat -->
	{#if totalSessions > 0}
		<p class="consent-caveat">
			<span class="i-lucide-info caveat-icon" aria-hidden="true"></span>
			{m.admin_analytics_consent_caveat({ rate: consentRate, total: formatNumber(totalSessions) })}
		</p>
	{/if}

	<!-- Retention cleanup status -->
	<p class="consent-caveat">
		<span class="i-lucide-broom caveat-icon" aria-hidden="true"></span>
		{m.admin_analytics_cleanup_last()} {formatRelativeAge(cleanupAgeMs)}{#if data.lastCleanup.resultCount != null}
			{m.admin_analytics_cleanup_rows_removed({ count: data.lastCleanup.resultCount })}
		{/if}
		{#if cleanupOverdue}
			<Tag variant="warning" label={m.admin_analytics_cleanup_overdue()} />
		{:else if data.lastCleanup.status === 'failure'}
			<Tag variant="error" label={m.admin_analytics_cleanup_last_run_failed()} />
		{/if}
	</p>

	<!-- Range selector -->
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">{m.admin_analytics_traffic_trend()}</h2>
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
					title={m.admin_analytics_trend_empty_title()}
					description={m.admin_analytics_trend_empty_description()}
				>
					{#if data.range !== '90'}
						<a href="/admin/analytics?range=90" class="text-primary hover:underline text-fluid-sm">
							{m.admin_analytics_trend_try_90_days()}
						</a>
					{/if}
				</EmptyState>
			{:else}
				<LineChart
					data={buildChartData(trend)}
					ariaLabel={m.admin_analytics_trend_aria_label({ range: data.range })}
				/>
			{/if}
		{:catch}
			<Alert
				variant="error"
				title={m.admin_analytics_trend_error_title()}
				description={m.admin_analytics_trend_error_description()}
			>
				<Button variant="outline" size="sm" onclick={() => invalidateAll()}>{m.composites_error_display_try_again()}</Button>
			</Alert>
		{/await}
	</Card>

	<!-- Bottom two-column: Top Pages + Consent Breakdown -->
	<div class="bottom-grid">
		<!-- Top Pages -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.admin_analytics_top_pages()}</h2>
			{/snippet}

			{#await data.topPages}
				<div class="flex flex-col gap-2">
					{#each Array(5) as _}
						<Skeleton variant="text" height="1.5rem" />
					{/each}
				</div>
			{:then pages}
				{#if pages.length === 0}
					<p class="text-muted text-fluid-sm">{m.admin_analytics_top_pages_empty()}</p>
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
					title={m.admin_analytics_top_pages_error_title()}
					description={m.admin_analytics_top_pages_error_description()}
				>
					<Button variant="outline" size="sm" onclick={() => invalidateAll()}>{m.composites_error_display_try_again()}</Button>
				</Alert>
			{/await}
		</Card>

		<!-- Consent Breakdown -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.admin_analytics_consent_breakdown()}</h2>
			{/snippet}

			{#if data.consentSplit.length === 0}
				<p class="text-muted text-fluid-sm">{m.admin_analytics_consent_breakdown_empty()}</p>
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

	<!-- Live Activity Feed -->
	<LiveFeed initialEvents={data.recentEvents} bind:pairedActive />
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
