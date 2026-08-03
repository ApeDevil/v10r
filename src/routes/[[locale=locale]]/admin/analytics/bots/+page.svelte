<script lang="ts">
import { Card, EmptyState } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Tag } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const ranges = [
	{ value: '7', label: '7d' },
	{ value: '30', label: '30d' },
	{ value: '90', label: '90d' },
];

const totalHits = $derived(data.families.reduce((sum, f) => sum + f.hits, 0));
const aiHits = $derived(data.families.filter((f) => f.category.startsWith('ai_')).reduce((sum, f) => sum + f.hits, 0));
/**
 * The security headline. Counted across families rather than shown per-row only:
 * one impersonated fetch is worth surfacing at the top, and a per-row percentage
 * buries it under whichever family happens to be noisiest.
 */
const spoofedHits = $derived(data.families.reduce((sum, f) => sum + f.spoofed, 0));

/** Total prefixes held. Zero means verification is inert, not that nobody lied. */
const totalPrefixes = $derived(data.rangeStatus.reduce((sum, s) => sum + s.prefixes, 0));

function formatNumber(n: number): string {
	return new Intl.NumberFormat().format(n);
}

function formatDate(d: Date | null): string {
	return d ? new Date(d).toLocaleString() : '—';
}

/**
 * A family's headline verdict.
 *
 * `unpublished` is deliberately neutral, not a warning: that operator publishes
 * no prefix list, so the claim is unknowable rather than doubtful. Rendering it
 * as a caution would flag every honest crawler whose operator simply has no feed.
 */
function verdict(row: (typeof data.families)[number]): {
	variant: 'success' | 'error' | 'warning' | 'secondary';
	label: string;
} {
	if (row.spoofed > 0) return { variant: 'error', label: m.admin_bots_verdict_spoofed({ count: row.spoofed }) };
	if (row.verified > 0) return { variant: 'success', label: m.admin_bots_verdict_verified() };
	if (row.unchecked > 0) return { variant: 'warning', label: m.admin_bots_verdict_unchecked() };
	// `secondary`, not a caution colour: no published ranges means unknowable, and
	// styling that as a warning would flag every honest crawler whose operator has
	// no feed to check against.
	return { variant: 'secondary', label: m.admin_bots_verdict_unpublished() };
}
</script>

<Stack gap="6">
	<Cluster justify="between" align="center">
		<div>
			<h1 class="text-fluid-2xl font-semibold">{m.admin_bots_title()}</h1>
			<p class="text-fluid-sm text-muted">{m.admin_bots_subtitle()}</p>
		</div>
		<div class="filter-bar">
			{#each ranges as r (r.value)}
				<a
					href="/admin/analytics/bots?range={r.value}"
					class="filter-link"
					class:active={data.range === r.value}
					aria-current={data.range === r.value ? 'page' : undefined}
				>
					{r.label}
				</a>
			{/each}
		</div>
	</Cluster>

	<!-- KPI strip -->
	<Card>
		<Cluster gap="6" wrap>
			<div class="stat">
				<span class="stat-value">{formatNumber(totalHits)}</span>
				<span class="stat-label">{m.admin_bots_kpi_total()}</span>
			</div>
			<div class="stat">
				<span class="stat-value">{formatNumber(aiHits)}</span>
				<span class="stat-label">{m.admin_bots_kpi_ai()}</span>
			</div>
			<div class="stat" class:muted={spoofedHits === 0}>
				<span class="stat-value">{formatNumber(spoofedHits)}</span>
				<span class="stat-label">{m.admin_bots_kpi_spoofed()}</span>
			</div>
			<div class="stat" class:muted={totalPrefixes > 0}>
				<span class="stat-value">{formatNumber(totalPrefixes)}</span>
				<span class="stat-label">{m.admin_bots_kpi_prefixes()}</span>
			</div>
		</Cluster>

		{#snippet footer()}
			{#if totalPrefixes === 0}
				<!--
					The failure this page is most likely to mislead on. With no prefixes
					stored nothing can be verified, so an all-clear reads as "nobody is
					impersonating anyone" when it actually means "we never checked".
				-->
				<p class="text-fluid-xs text-muted">
					<Tag variant="warning" label={m.admin_bots_ranges_missing()} />
					{m.admin_bots_ranges_missing_detail()}
				</p>
			{:else}
				<p class="text-fluid-xs text-muted">
					{#each data.rangeStatus as s (s.source)}
						<span class="range-chip">{s.source}: {s.prefixes} · {formatDate(s.fetchedAt)}</span>
					{/each}
				</p>
			{/if}
		{/snippet}
	</Card>

	<!-- CARD 1 — who is crawling, and are they who they claim -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.admin_bots_families_title()}</h2>
		{/snippet}

		{#if data.families.length === 0}
			<EmptyState
				icon="i-lucide-bot"
				title={m.admin_bots_empty_title()}
				description={m.admin_bots_empty_description()}
			/>
		{:else}
			<div class="table-wrap" tabindex="0" role="region" aria-label={m.admin_bots_families_title()}>
				<table class="data-table">
					<thead>
						<tr>
							<th>{m.admin_bots_col_family()}</th>
							<th>{m.admin_bots_col_category()}</th>
							<th>{m.admin_bots_col_hits()}</th>
							<th>{m.admin_bots_col_identity()}</th>
							<th>{m.admin_bots_col_last_seen()}</th>
						</tr>
					</thead>
					<tbody>
						{#each data.families as row (row.family + row.category)}
							{@const v = verdict(row)}
							<tr>
								<td class="mono-cell">{row.family}</td>
								<td><Badge variant="outline">{row.category}</Badge></td>
								<td>{formatNumber(row.hits)}</td>
								<td><Tag variant={v.variant} label={v.label} /></td>
								<td class="text-muted">{formatDate(row.lastSeen)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>

	<!-- CARD 2 — the AX return on investment -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.admin_bots_agent_surfaces_title()}</h2>
		{/snippet}
		<p class="text-fluid-sm text-muted">{m.admin_bots_agent_surfaces_help()}</p>

		{#await data.agentSurfaces}
			<div class="skeleton-table"></div>
		{:then surfaces}
			{#if surfaces.length === 0}
				<EmptyState
					icon="i-lucide-file-code"
					title={m.admin_bots_agent_empty_title()}
					description={m.admin_bots_agent_empty_description()}
				/>
			{:else}
				<div class="table-wrap" tabindex="0" role="region" aria-label={m.admin_bots_agent_surfaces_title()}>
					<table class="data-table">
						<thead>
							<tr>
								<th>{m.admin_bots_col_path()}</th>
								<th>{m.admin_bots_col_family()}</th>
								<th>{m.admin_bots_col_hits()}</th>
								<th>{m.admin_bots_col_last_seen()}</th>
							</tr>
						</thead>
						<tbody>
							{#each surfaces as s (s.path + s.family)}
								<tr>
									<td class="mono-cell">{s.path}</td>
									<td><Badge variant="outline">{s.family}</Badge></td>
									<td>{formatNumber(s.hits)}</td>
									<td class="text-muted">{formatDate(s.lastSeen)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{:catch}
			<p class="text-fluid-sm text-muted">{m.admin_bots_load_error()}</p>
		{/await}
	</Card>

	<!-- CARD 3 — probes and dead links. Only meaningful once something has failed. -->
	{#await data.misses then misses}
		{#if misses.length > 0}
			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">{m.admin_bots_misses_title()}</h2>
				{/snippet}
				<p class="text-fluid-sm text-muted">{m.admin_bots_misses_help()}</p>
				<div class="table-wrap" tabindex="0" role="region" aria-label={m.admin_bots_misses_title()}>
					<table class="data-table">
						<thead>
							<tr>
								<th>{m.admin_bots_col_path()}</th>
								<th>{m.admin_bots_col_status()}</th>
								<th>{m.admin_bots_col_family()}</th>
								<th>{m.admin_bots_col_hits()}</th>
							</tr>
						</thead>
						<tbody>
							{#each misses as miss (miss.path + miss.status + miss.family)}
								<tr>
									<td class="mono-cell">{miss.path}</td>
									<td>{miss.status}</td>
									<td><Badge variant="outline">{miss.family}</Badge></td>
									<td>{formatNumber(miss.hits)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Card>
		{/if}
	{/await}
</Stack>

<style>
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
.filter-link.active {
	background: var(--color-fg);
	color: var(--color-bg);
}
.table-wrap {
	overflow-x: auto;
	border-radius: var(--radius-md);
}
.table-wrap:focus-visible {
	outline: 2px solid var(--color-primary);
	outline-offset: 2px;
}
.data-table {
	width: 100%;
	border-collapse: collapse;
	font-size: var(--text-fluid-sm);
}
.data-table th,
.data-table td {
	padding: var(--spacing-2) var(--spacing-3);
	text-align: left;
	border-bottom: 1px solid var(--color-border);
	white-space: nowrap;
}
.data-table th {
	color: var(--color-muted);
	font-weight: 500;
}
/* Crawler-supplied path: text position only, never interpolated into an attribute. */
.mono-cell {
	font-family: ui-monospace, monospace;
	max-width: 32rem;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.stat {
	display: flex;
	flex-direction: column;
}
.stat-value {
	font-size: var(--text-fluid-xl);
	font-weight: 600;
}
.stat.muted .stat-value {
	color: var(--color-muted);
	font-weight: 500;
}
.stat-label {
	font-size: var(--text-fluid-xs);
	color: var(--color-muted);
}
.range-chip {
	display: inline-block;
	margin-right: var(--spacing-3);
	font-family: ui-monospace, monospace;
}
.skeleton-table {
	height: 200px;
	background: var(--color-subtle);
	border-radius: var(--radius-md);
	animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
	0%,
	100% {
		opacity: 1;
	}
	50% {
		opacity: 0.5;
	}
}
</style>
