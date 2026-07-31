<script lang="ts">
import type { ChartData } from 'chart.js';
import { invalidateAll } from '$app/navigation';
import { page } from '$app/state';
import LiveFeed from '$lib/components/admin/LiveFeed.svelte';
import { Alert, Card, DiagGrid, DiagRow, EmptyState } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Button, Skeleton, Tag } from '$lib/components/primitives';
import LineChart from '$lib/components/viz/chart/line/LineChart.svelte';
import { getFormattingLocale } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { baseLocale, extractLocaleFromUrl } from '$lib/paraglide/runtime';
import { formatDuration } from '$lib/utils/format-duration';

let { data }: PageProps = $props();
let pairedActive = $state(data.pairedActive);

/** Shapes come from the deferred loader, so no server type crosses into the client. */
type AudienceRow = Awaited<typeof data.audience>['countries'][number];

const UNKNOWN_COUNTRY = 'ZZ';
const UNKNOWN_CLIENT = 'unknown';
/** Rows shown per dimension before collapsing into an "and N more" line. */
const AUDIENCE_ROWS = 8;

const formattingLocale = $derived(getFormattingLocale(extractLocaleFromUrl(page.url.href) ?? baseLocale));

const regionNames = $derived.by(() => {
	try {
		return new Intl.DisplayNames([formattingLocale], { type: 'region' });
	} catch {
		return null;
	}
});

/**
 * "DE" → "Germany" in the admin's own language. Falls back to the raw code,
 * which is still readable — `Intl.DisplayNames.of` throws on malformed input.
 */
function countryLabel(code: string): string {
	if (code === UNKNOWN_COUNTRY) return m.admin_analytics_audience_unknown();
	try {
		return regionNames?.of(code) ?? code;
	} catch {
		return code;
	}
}

/** Regional-indicator pair. Degrades to the bare letters where flags aren't drawn. */
function countryFlag(code: string): string {
	if (code === UNKNOWN_COUNTRY || !/^[A-Z]{2}$/.test(code)) return '';
	return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function clientLabel(key: string): string {
	return key === UNKNOWN_CLIENT ? m.admin_analytics_audience_unknown() : key;
}

// Consent rate as percentage
const totalSessions = $derived(data.consentSplit.reduce((sum, s) => sum + Number(s.count), 0));
const consentedSessions = $derived(
	data.consentSplit.filter((s) => s.tier === 'analytics').reduce((sum, s) => sum + Number(s.count), 0),
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

function buildChartData(trend: typeof data.trend extends Promise<infer T> ? T : never): ChartData<'line'> {
	return {
		labels: trend.map((t) => t.date),
		datasets: [
			{
				label: m.admin_analytics_chart_pageviews(),
				data: trend.map((t) => Number(t.pageviews)),
				borderColor: 'var(--chart-1)',
				backgroundColor: 'color-mix(in srgb, var(--chart-1) 20%, transparent)',
				fill: true,
				tension: 0.3,
			},
			{
				label: m.admin_analytics_chart_unique_visitors(),
				data: trend.map((t) => Number(t.uniqueVisitors)),
				borderColor: 'var(--chart-2)',
				backgroundColor: 'color-mix(in srgb, var(--chart-2) 20%, transparent)',
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

	<!-- Audience: distinct visitors by origin and client -->
	<Card>
		{#snippet header()}
			<Stack gap="1">
				<h2 class="text-fluid-lg font-semibold">{m.admin_analytics_audience_title()}</h2>
				<p class="text-muted text-fluid-xs">{m.admin_analytics_audience_description()}</p>
			</Stack>
		{/snippet}
		{#await data.audience}
			<Skeleton variant="rectangular" height="220px" />
		{:then audience}
			{#if audience.totalVisitors === 0}
				<p class="text-muted text-fluid-sm">{m.admin_analytics_audience_empty()}</p>
			{:else}
				<Stack gap="5">
					<div class="audience-grid">
						{@render dimension(m.admin_analytics_audience_countries(), audience.countries, audience.totalVisitors, true)}
						{@render dimension(m.admin_analytics_audience_devices(), audience.devices, audience.totalVisitors, false)}
						{@render dimension(m.admin_analytics_audience_browsers(), audience.browsers, audience.totalVisitors, false)}
					</div>
					<Stack gap="1">
						<p class="text-muted text-fluid-xs">
							{m.admin_analytics_audience_coverage_geo({
								known: formatNumber(audience.locatedVisitors),
								total: formatNumber(audience.totalVisitors),
							})}
						</p>
						<p class="text-muted text-fluid-xs">
							{m.admin_analytics_audience_coverage_client({
								known: formatNumber(audience.classifiedVisitors),
								total: formatNumber(audience.totalVisitors),
							})}
						</p>
					</Stack>
				</Stack>
			{/if}
		{:catch}
			<p class="text-muted text-fluid-sm">{m.admin_analytics_audience_empty()}</p>
		{/await}
	</Card>

	<!-- Live Activity Feed -->
	<!-- Web Vitals: p75, with the element most often to blame -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.admin_analytics_vitals_title()}</h2>
		{/snippet}
		{#await data.vitals}
			<Skeleton variant="rectangular" height="120px" />
		{:then vitals}
			{#if vitals.length === 0}
				<p class="text-muted text-fluid-sm">{m.admin_analytics_vitals_empty()}</p>
			{:else}
				<div class="vitals-grid">
					{#each vitals as v (v.metric)}
						<div class="vital-card">
							<span class="stat-label">{v.metric}</span>
							<span class="stat-value">{v.metric === 'CLS' ? v.p75 : `${Math.round(v.p75)}ms`}</span>
							<span class="vital-meta">{m.admin_analytics_vitals_samples({ count: v.samples })}</span>
							{#if v.worstTarget}
								<span class="vital-meta">
									{m.admin_analytics_vitals_blame()}: <code>{v.worstTarget}</code>
								</span>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{:catch}
			<p class="text-muted text-fluid-sm">{m.admin_analytics_vitals_empty()}</p>
		{/await}
	</Card>

	<div class="bottom-grid">
		<!-- Friction: rage + dead clicks -->
		<Card>
			{#snippet header()}
				<Stack gap="1">
					<h2 class="text-fluid-lg font-semibold">{m.admin_analytics_friction_title()}</h2>
					<p class="text-muted text-fluid-xs">{m.admin_analytics_friction_description()}</p>
				</Stack>
			{/snippet}
			{#await data.friction}
				<Skeleton variant="rectangular" height="160px" />
			{:then friction}
				{#if friction.length === 0}
					<p class="text-muted text-fluid-sm">{m.admin_analytics_friction_empty()}</p>
				{:else}
					<div class="friction-list">
						{#each friction as f (`${f.event}${f.target}${f.route}`)}
							<div class="friction-row">
								<Tag variant={f.event === 'rage_click' ? 'error' : 'warning'} label={f.event} />
								<code class="friction-target">{f.target}</code>
								<code class="friction-route">{f.route}</code>
								<span class="friction-count">{f.count}</span>
							</div>
						{/each}
					</div>
				{/if}
			{:catch}
				<p class="text-muted text-fluid-sm">{m.admin_analytics_friction_empty()}</p>
			{/await}
		</Card>

		<!-- Authenticated lane -->
		<Card>
			{#snippet header()}
				<Stack gap="1">
					<h2 class="text-fluid-lg font-semibold">{m.admin_analytics_userlane_title()}</h2>
					<p class="text-muted text-fluid-xs">{m.admin_analytics_userlane_description()}</p>
				</Stack>
			{/snippet}
			{#await data.userLane}
				<Skeleton variant="rectangular" height="160px" />
			{:then lane}
				<Stack gap="4">
					<DiagGrid>
						<DiagRow label={m.admin_analytics_userlane_active()}>{formatNumber(lane.activeUsers)}</DiagRow>
						<DiagRow label={m.admin_analytics_userlane_events()}>{formatNumber(lane.events)}</DiagRow>
					</DiagGrid>
					{#if lane.topRoutes.length === 0}
						<p class="text-muted text-fluid-sm">{m.admin_analytics_userlane_empty()}</p>
					{:else}
						<div class="friction-list">
							{#each lane.topRoutes as r (r.route)}
								<div class="lane-row">
									<code class="friction-route">{r.route}</code>
									<span class="friction-count">{r.count}</span>
								</div>
							{/each}
						</div>
					{/if}
				</Stack>
			{:catch}
				<p class="text-muted text-fluid-sm">{m.admin_analytics_userlane_empty()}</p>
			{/await}
		</Card>
	</div>

	<LiveFeed initialEvents={data.recentEvents} bind:pairedActive />
</Stack>

{#snippet dimension(title: string, rows: AudienceRow[], total: number, geo: boolean)}
	<div class="audience-col">
		<h3 class="audience-col-title">{title}</h3>
		{#each rows.slice(0, AUDIENCE_ROWS) as row (row.key)}
			{@const pct = total > 0 ? Math.round((row.visitors / total) * 100) : 0}
			{@const perVisitor = (row.sessions / row.visitors).toFixed(1)}
			<div class="audience-row">
				<span class="audience-label" title={m.admin_analytics_audience_sessions_per({ rate: perVisitor })}>
					{#if geo}<span class="audience-flag" aria-hidden="true">{countryFlag(row.key)}</span>{/if}
					{geo ? countryLabel(row.key) : clientLabel(row.key)}
				</span>
				<span class="audience-count">{formatNumber(row.visitors)}</span>
				<span class="audience-pct">{pct}%</span>
				<span class="audience-track" aria-hidden="true">
					<span class="audience-fill" style:width="{pct}%"></span>
				</span>
			</div>
		{/each}
		{#if rows.length > AUDIENCE_ROWS}
			<p class="text-muted text-fluid-xs audience-more">
				{m.admin_analytics_audience_more({ count: rows.length - AUDIENCE_ROWS })}
			</p>
		{/if}
	</div>
{/snippet}

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

	/* Audience breakdown */
	.audience-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
		gap: var(--spacing-6);
	}

	.audience-col {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		min-width: 0;
	}

	.audience-col-title {
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-muted);
	}

	/* Label | count | pct on one line, the bar spanning underneath. */
	.audience-row {
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: baseline;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-sm);
	}

	.audience-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.audience-flag {
		margin-right: var(--spacing-1);
	}

	.audience-count {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}

	.audience-pct {
		font-variant-numeric: tabular-nums;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		min-width: 2.5rem;
		text-align: right;
	}

	.audience-track {
		grid-column: 1 / -1;
		height: 3px;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
		overflow: hidden;
	}

	.audience-fill {
		display: block;
		height: 100%;
		background: var(--chart-1);
	}

	.audience-more {
		margin-top: var(--spacing-1);
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

	.vitals-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
		gap: var(--spacing-4);
	}

	.vital-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		min-width: 0;
	}

	.vital-meta {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.friction-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.friction-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1.4fr) minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.lane-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.friction-target,
	.friction-route {
		font-size: var(--text-fluid-xs);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.friction-route {
		color: var(--color-muted);
	}

	.friction-count {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--color-muted);
	}
</style>
