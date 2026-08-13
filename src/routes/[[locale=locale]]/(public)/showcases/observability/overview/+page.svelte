<script lang="ts">
import { Card } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Typography } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const VERDICT_VARIANT = { pass: 'success', warn: 'warning', fail: 'error' } as const;

function verdictVariant(verdict: 'pass' | 'warn' | 'fail' | null) {
	return verdict ? VERDICT_VARIANT[verdict] : 'secondary';
}

function verdictLabel(verdict: 'pass' | 'warn' | 'fail' | null) {
	if (verdict === 'pass') return m.perf_verdict_pass();
	if (verdict === 'warn') return m.perf_verdict_warn();
	if (verdict === 'fail') return m.perf_verdict_fail();
	return m.perf_verdict_unscored();
}

function formatVital(metric: string, value: number | null) {
	if (value === null) return '—';
	return metric === 'CLS' ? value.toFixed(3) : `${Math.round(value)} ms`;
}

const LANE_LABEL: Record<string, () => string> = {
	prod: m.perf_lane_prod,
	dev: m.perf_lane_dev,
	unknown: m.perf_lane_unknown,
};
</script>

<Stack gap="6">
	<p class="lead">{m.showcase_obs_overview_lead()}</p>

	<!-- Field half -->
	<Card>
		<Stack gap="3">
			<Stack gap="1">
				<Typography variant="h2">{m.showcase_obs_overview_field_title()}</Typography>
				<p class="text-muted text-fluid-sm">{m.showcase_obs_overview_field_desc()}</p>
			</Stack>

			{#if data.vitals.length === 0}
				<p class="text-muted text-fluid-sm">{m.perf_empty()}</p>
			{:else}
				<div class="grid">
					{#each data.vitals as v (v.metric)}
						<div class="stat" class:provisional={v.provisional}>
							<Cluster justify="between" align="center">
								<span class="stat-label">{v.metric}</span>
								<Badge variant={verdictVariant(v.verdict)}>{verdictLabel(v.verdict)}</Badge>
							</Cluster>
							<span class="stat-value">{formatVital(v.metric, v.p75)}</span>
							<span class="stat-meta">
								{m.perf_samples({ count: v.samples })}
								{#if v.provisional}
									· <em>{m.perf_provisional()}</em>
								{/if}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</Stack>
	</Card>

	<!-- Lane split: the reason the numbers above can be trusted at all -->
	<Card>
		<Stack gap="3">
			<Stack gap="1">
				<Typography variant="h2">{m.showcase_obs_overview_lane_title()}</Typography>
				<p class="text-muted text-fluid-sm">{m.showcase_obs_overview_lane_desc()}</p>
			</Stack>

			{#if data.lanes.total === 0}
				<p class="text-muted text-fluid-sm">{m.perf_empty()}</p>
			{:else}
				<div class="lane-strip" role="img" aria-label={m.admin_perf_lane_share({ pct: String(data.lanes.prodShare) })}>
					{#each data.lanes.census as row (row.lane)}
						<div class="lane-seg lane-{row.lane}" style="flex-grow: {row.samples}"></div>
					{/each}
				</div>
				<Cluster gap="4" wrap>
					{#each data.lanes.census as row (row.lane)}
						<span class="lane-key">
							<span class="lane-dot lane-{row.lane}" aria-hidden="true"></span>
							{LANE_LABEL[row.lane]?.() ?? row.lane}
							<strong>{row.samples}</strong>
						</span>
					{/each}
				</Cluster>
				<p class="text-muted text-fluid-sm">
					{m.showcase_obs_overview_lane_note({ pct: String(data.lanes.prodShare) })}
				</p>
			{/if}
		</Stack>
	</Card>

	<!-- Lab half -->
	<Card>
		<Stack gap="3">
			<Stack gap="1">
				<Typography variant="h2">{m.showcase_obs_overview_lab_title()}</Typography>
				<p class="text-muted text-fluid-sm">{m.showcase_obs_overview_lab_desc()}</p>
			</Stack>

			<div class="grid">
				{#each data.lab.scored as s (s.metric)}
					<div class="stat">
						<Cluster justify="between" align="center">
							<span class="stat-label"><code>{s.metric}</code></span>
							<Badge variant={verdictVariant(s.verdict)}>{verdictLabel(s.verdict)}</Badge>
						</Cluster>
						<span class="stat-value">{s.value} KB</span>
						<span class="stat-meta">{m.perf_thresholds({ warn: s.warn, fail: s.fail })}</span>
					</div>
				{/each}
			</div>

			<p class="text-muted text-fluid-xs">
				{m.showcase_obs_overview_measured({ date: data.lab.generatedAt.slice(0, 10), env: data.lab.nodeEnv })}
			</p>
		</Stack>
	</Card>
</Stack>

<style>
	.lead {
		font-size: var(--text-fluid-lg);
		max-width: 62ch;
		color: var(--color-fg);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
		gap: var(--spacing-4);
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		min-width: 0;
	}

	.stat.provisional .stat-value {
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

	.stat-meta {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.lane-strip {
		display: flex;
		height: var(--spacing-2);
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--color-surface-2);
	}

	.lane-seg {
		min-width: 2px;
	}

	.lane-dot {
		display: inline-block;
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
	}

	.lane-prod {
		background: var(--color-success);
	}

	.lane-dev {
		background: var(--color-warning);
	}

	.lane-unknown {
		background: var(--color-muted);
	}

	.lane-key {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-sm);
	}
</style>
