<script lang="ts">
import { Alert, Card } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Skeleton, Typography } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { BudgetVerdict } from '$lib/server/perf';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const ranges = [
	{ value: '7', label: '7d' },
	{ value: '30', label: '30d' },
	{ value: '90', label: '90d' },
];

const VERDICT_VARIANT = {
	pass: 'success',
	warn: 'warning',
	fail: 'error',
} as const;

function verdictVariant(verdict: BudgetVerdict | null) {
	return verdict ? VERDICT_VARIANT[verdict] : 'secondary';
}

function verdictLabel(verdict: BudgetVerdict | null) {
	if (verdict === 'pass') return m.perf_verdict_pass();
	if (verdict === 'warn') return m.perf_verdict_warn();
	if (verdict === 'fail') return m.perf_verdict_fail();
	return m.perf_verdict_unscored();
}

/** CLS is a unitless ratio; every other Web Vital is milliseconds. */
function formatVital(metric: string, value: number | null) {
	if (value === null) return '—';
	return metric === 'CLS' ? value.toFixed(3) : `${Math.round(value)} ms`;
}

const GAP_LABEL: Record<string, () => string> = {
	lt1m: m.admin_perf_gap_lt1m,
	'1to15m': m.admin_perf_gap_1to15m,
	'15to60m': m.admin_perf_gap_15to60m,
	gt60m: m.admin_perf_gap_gt60m,
};

const LANE_LABEL: Record<string, () => string> = {
	prod: m.perf_origin_prod,
	dev: m.perf_origin_dev,
	unknown: m.perf_origin_unknown,
};

/**
 * Bar width as a share of the largest value in the same panel.
 *
 * Zero stays zero: a floor of 1% on an absent measurement draws a stub that
 * reads as "small" when the truth is "no data".
 */
function share(value: number, max: number) {
	if (value <= 0 || max <= 0) return 0;
	return Math.max(1, Math.round((value / max) * 100));
}
</script>

<Stack gap="6">
	<Cluster justify="between" align="center">
		<Stack gap="1">
			<Typography variant="h1">{m.admin_perf_title()}</Typography>
			<p class="text-muted text-fluid-sm">{m.admin_perf_subtitle()}</p>
		</Stack>
		<nav class="filter-bar" aria-label={m.admin_perf_range_label()}>
			{#each ranges as r (r.value)}
				<a
					href="/admin/perf?range={r.value}"
					class="filter-link"
					class:active={data.range === r.value}
					aria-current={data.range === r.value ? 'page' : undefined}
				>
					{r.label}
				</a>
			{/each}
		</nav>
	</Cluster>

	<!-- Lane health first: it qualifies every field number below it. A panel that
	     silently drops 72% of its rows is not a panel you read second. -->
	<Card>
		<Stack gap="3">
			<Stack gap="1">
				<Typography variant="h2">{m.admin_perf_panel_origins_title()}</Typography>
				<p class="text-muted text-fluid-sm">{m.admin_perf_panel_origins_desc()}</p>
			</Stack>

			{#await data.origins}
				<Skeleton variant="rectangular" height="72px" />
			{:then origins}
				{#if origins.total === 0}
					<p class="text-muted text-fluid-sm">{m.perf_empty()}</p>
				{:else}
					<div class="origin-strip" role="img" aria-label={m.admin_perf_origin_share({ pct: String(origins.prodShare) })}>
						{#each origins.census as row (row.origin)}
							<div
								class="origin-seg origin-{row.origin}"
								style="flex-grow: {row.samples}"
								title="{LANE_LABEL[row.origin]?.() ?? row.origin}: {row.samples}"
							></div>
						{/each}
					</div>
					<Cluster gap="4" wrap>
						{#each origins.census as row (row.origin)}
							<span class="origin-key">
								<span class="origin-dot origin-{row.origin}" aria-hidden="true"></span>
								{LANE_LABEL[row.origin]?.() ?? row.origin}
								<strong>{row.samples}</strong>
								<span class="text-muted">({m.perf_sessions({ count: row.sessions })})</span>
							</span>
						{/each}
					</Cluster>

					{#if origins.devSamples > 0}
						<Alert variant="warning" description={m.admin_perf_origin_dev_present({ count: origins.devSamples })} />
					{/if}
				{/if}
			{:catch}
				<p class="text-muted text-fluid-sm">{m.perf_empty()}</p>
			{/await}
		</Stack>
	</Card>

	<!-- Field vitals -->
	<Card>
		<Stack gap="3">
			<Stack gap="1">
				<Typography variant="h2">{m.admin_perf_panel_field_title()}</Typography>
				<p class="text-muted text-fluid-sm">{m.admin_perf_panel_field_desc()}</p>
			</Stack>

			{#await data.vitals}
				<Skeleton variant="rectangular" height="140px" />
			{:then vitals}
				{#if vitals.length === 0}
					<p class="text-muted text-fluid-sm">{m.perf_empty()}</p>
				{:else}
					<div class="vitals-grid">
						{#each vitals as v (v.metric)}
							<div class="vital-card" class:provisional={v.provisional}>
								<Cluster justify="between" align="center">
									<span class="stat-label">{v.metric}</span>
									<Badge variant={verdictVariant(v.verdict)}>{verdictLabel(v.verdict)}</Badge>
								</Cluster>

								<span class="stat-value">{formatVital(v.metric, v.p75)}</span>

								<span class="vital-meta">
									{m.perf_samples({ count: v.samples })}
									{#if v.provisional}
										· <em>{m.perf_provisional()}</em>
									{/if}
								</span>

								{#if v.warn !== null}
									<span class="vital-meta">{m.perf_thresholds({ warn: v.warn, fail: v.fail ?? 0 })}</span>
								{/if}

								{#if v.devSamples > 0 || v.unknownSamples > 0}
									<span class="vital-meta">
										{m.admin_perf_excluded({ dev: v.devSamples, unknown: v.unknownSamples })}
									</span>
								{/if}

								{#if v.worstTarget}
									<span class="vital-meta blame" title={v.worstTarget}>
										{m.perf_blame()}: <code>{v.worstTarget}</code>
									</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			{:catch}
				<p class="text-muted text-fluid-sm">{m.perf_empty()}</p>
			{/await}
		</Stack>
	</Card>

	<!-- Idle-gap profile -->
	<Card>
		<Stack gap="3">
			<Stack gap="1">
				<Typography variant="h2">{m.admin_perf_panel_idlegap_title()}</Typography>
				<p class="text-muted text-fluid-sm">{m.admin_perf_panel_idlegap_desc()}</p>
			</Stack>

			{#await data.idleGap}
				<Skeleton variant="rectangular" height="120px" />
			{:then gap}
				{#if !gap.readable}
					<Alert variant="info" description={m.admin_perf_gap_insufficient()} />
				{/if}

				{#if gap.rows.some((r) => r.samples > 0)}
					{@const max = Math.max(...gap.rows.map((r) => r.p50 ?? 0))}
					<table class="data-table">
						<thead>
							<tr>
								<th scope="col">{m.admin_perf_gap_col_bucket()}</th>
								<th scope="col" class="num">{m.admin_perf_gap_col_p50()}</th>
								<th scope="col" class="num">{m.admin_perf_gap_col_p75()}</th>
								<th scope="col" class="num">{m.admin_perf_gap_col_samples()}</th>
							</tr>
						</thead>
						<tbody>
							{#each gap.rows as row (row.bucket)}
								<tr class:empty={row.samples === 0}>
									<th scope="row">{GAP_LABEL[row.bucket]?.() ?? row.bucket}</th>
									<td class="num">
										<span class="bar-cell">
											<span class="bar-track">
												<span class="bar" style="width: {share(row.p50 ?? 0, max)}%"></span>
											</span>
											<span class="bar-value">{row.p50 === null ? '—' : `${row.p50} ms`}</span>
										</span>
									</td>
									<td class="num">{row.p75 === null ? '—' : `${row.p75} ms`}</td>
									<td class="num">{row.samples}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			{:catch}
				<p class="text-muted text-fluid-sm">{m.perf_empty()}</p>
			{/await}
		</Stack>
	</Card>

	<!-- Lab snapshot -->
	<Card>
		<Stack gap="3">
			<Stack gap="1">
				<Typography variant="h2">{m.admin_perf_panel_lab_title()}</Typography>
				<p class="text-muted text-fluid-sm">{m.admin_perf_panel_lab_desc()}</p>
			</Stack>

			{#if !data.lab.scoreable}
				<Alert variant="error" description={m.admin_perf_lab_devmode({ env: data.lab.nodeEnv })} />
			{:else if data.lab.ageDays > 14}
				<Alert variant="warning" description={m.admin_perf_lab_stale({ days: data.lab.ageDays })} />
			{/if}

			<div class="vitals-grid">
				{#each data.lab.scored as s (s.metric)}
					<div class="vital-card">
						<Cluster justify="between" align="center">
							<span class="stat-label">{s.metric}</span>
							<Badge variant={verdictVariant(s.verdict)}>{verdictLabel(s.verdict)}</Badge>
						</Cluster>
						<span class="stat-value">{s.value} KB</span>
						<span class="vital-meta">{m.perf_thresholds({ warn: s.warn, fail: s.fail })}</span>
						<span class="vital-meta">{s.note}</span>
					</div>
				{/each}

				<div class="vital-card">
					<span class="stat-label">{m.admin_perf_lab_baseline()}</span>
					<span class="stat-value">{data.lab.metrics.baseline_js_kb} KB</span>
					<span class="vital-meta">{m.admin_perf_lab_baseline_note({ count: data.lab.metrics.route_count })}</span>
					<span class="vital-meta">
						{m.admin_perf_lab_median({ kb: data.lab.metrics.median_route_js_kb })}
					</span>
				</div>
			</div>

			<!-- The ratchet. Targets above say where we want to be; this says what the
			     build is not allowed to exceed, and it is the half that fails CI. -->
			<Stack gap="2">
				<Typography variant="h3">{m.admin_perf_ratchet_title()}</Typography>
				<p class="text-muted text-fluid-sm">{m.admin_perf_ratchet_desc()}</p>
				<table class="data-table">
					<thead>
						<tr>
							<th scope="col">{m.admin_perf_ratchet_col_metric()}</th>
							<th scope="col" class="num">{m.admin_perf_ratchet_col_value()}</th>
							<th scope="col" class="num">{m.admin_perf_ratchet_col_ceiling()}</th>
							<th scope="col" class="num">{m.admin_perf_ratchet_col_slack()}</th>
						</tr>
					</thead>
					<tbody>
						{#each data.lab.ratchets as r (r.metric)}
							<tr>
								<th scope="row"><code>{r.metric}</code></th>
								<td class="num">{r.value}</td>
								<td class="num">{r.ceiling}</td>
								<td class="num">
									<Badge variant={r.exceeds ? 'error' : 'secondary'}>
										{r.exceeds ? m.admin_perf_ratchet_exceeded() : `+${r.slackKb}`}
									</Badge>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</Stack>

			<p class="text-muted text-fluid-xs">
				{m.admin_perf_lab_provenance({
					date: data.lab.generatedAt.slice(0, 10),
					sha: data.lab.gitSha ?? '—',
					env: data.lab.nodeEnv,
				})}
			</p>
		</Stack>
	</Card>

	<!-- Hot paths -->
	<Card>
		<Stack gap="3">
			<Stack gap="1">
				<Typography variant="h2">{m.admin_perf_panel_hotpaths_title()}</Typography>
				<p class="text-muted text-fluid-sm">{m.admin_perf_panel_hotpaths_desc()}</p>
			</Stack>

			{#await data.hotPaths}
				<Skeleton variant="rectangular" height="200px" />
			{:then paths}
				{#if paths.length === 0}
					<p class="text-muted text-fluid-sm">{m.perf_empty()}</p>
				{:else}
					{@const max = Math.max(...paths.map((p) => p.renders + p.botHits))}
					<table class="data-table">
						<thead>
							<tr>
								<th scope="col">{m.admin_perf_col_route()}</th>
								<th scope="col" class="num">{m.admin_perf_col_renders()}</th>
								<th scope="col" class="num">{m.admin_perf_col_bots()}</th>
								<th scope="col">{m.admin_perf_col_mix()}</th>
							</tr>
						</thead>
						<tbody>
							{#each paths as p (p.route)}
								<tr>
									<th scope="row"><code>{p.route}</code></th>
									<td class="num">{p.renders.toLocaleString()}</td>
									<td class="num">{p.botHits.toLocaleString()}</td>
									<td>
										<span
											class="mix-bar"
											role="img"
											aria-label={m.admin_perf_mix_aria({ human: p.renders, bot: p.botHits })}
										>
											<span class="mix-human" style="width: {share(p.renders, max)}%"></span>
											<span class="mix-bot" style="width: {share(p.botHits, max)}%"></span>
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			{:catch}
				<p class="text-muted text-fluid-sm">{m.perf_empty()}</p>
			{/await}
		</Stack>
	</Card>
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

	.filter-link:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.origin-strip {
		display: flex;
		height: var(--spacing-2);
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--color-surface-2);
	}

	.origin-seg {
		min-width: 2px;
	}

	.origin-dot {
		display: inline-block;
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
	}

	.origin-prod {
		background: var(--color-success);
	}

	.origin-dev {
		background: var(--color-warning);
	}

	.origin-unknown {
		background: var(--color-muted);
	}

	.origin-key {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-xs);
	}

	.vitals-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
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

	/* A percentile over too few samples is drawn quieter than one that earned it. */
	.vital-card.provisional .stat-value {
		opacity: 0.65;
	}

	.stat-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.stat-value {
		font-size: var(--text-fluid-xl);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.vital-meta {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		min-width: 0;
	}

	.blame {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.vital-meta code {
		font-size: 0.9em;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.data-table th,
	.data-table td {
		padding: var(--spacing-2);
		text-align: left;
		border-bottom: 1px solid var(--color-border);
		font-weight: 400;
	}

	.data-table thead th {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		white-space: nowrap;
	}

	.data-table tbody th {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		max-width: 22rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.data-table .num {
		text-align: right;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.data-table tr.empty {
		opacity: 0.5;
	}

	.bar-cell {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		justify-content: flex-end;
		width: 100%;
	}

	/* Fixed-width track so the bar's percentage is measured against a constant.
	   Sizing the bar as a share of the (fluid) cell and then clamping it with
	   max-width made every value above the clamp render identically. */
	.bar-track {
		display: block;
		width: 8rem;
		height: var(--spacing-1);
		border-radius: var(--radius-sm);
		background: var(--color-surface-2);
		overflow: hidden;
		flex: none;
	}

	.bar {
		display: block;
		height: 100%;
		border-radius: var(--radius-sm);
		background: var(--color-primary);
	}

	.bar-value {
		min-width: 5rem;
		text-align: right;
	}

	.mix-bar {
		display: flex;
		height: var(--spacing-2);
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--color-surface-2);
		min-width: 6rem;
	}

	.mix-human {
		background: var(--color-primary);
	}

	.mix-bot {
		background: var(--color-muted);
	}
</style>
