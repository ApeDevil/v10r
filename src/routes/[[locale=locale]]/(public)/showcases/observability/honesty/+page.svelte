<script lang="ts">
import { Alert, Card } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Typography } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const LANE_LABEL: Record<string, () => string> = {
	prod: m.perf_lane_prod,
	dev: m.perf_lane_dev,
	unknown: m.perf_lane_unknown,
};

const DEV_TARGET = 'nav.flex-1.overflow-y-auto.p-2.s-Xv7_7mcdkQaC.scrollbar-nav';
const PROD_TARGET = 'nav.flex-1.overflow-y-auto.p-2.scrollbar-nav.svelte-1e55qdy';

const delta = $derived(
	Math.round(
		((data.contamination.honestP75 - data.contamination.contaminatedP75) / data.contamination.honestP75) * 100,
	),
);
</script>

<Stack gap="6">
	<p class="lead">{m.showcase_obs_honesty_lead()}</p>

	<Card>
		<Stack gap="3">
			<Typography variant="h2">{m.showcase_obs_honesty_problem_title()}</Typography>
			<p>{m.showcase_obs_honesty_problem_body()}</p>

			<div class="compare">
				<div class="compare-cell bad">
					<span class="compare-label">{m.showcase_obs_honesty_contaminated()}</span>
					<span class="compare-value">{data.contamination.contaminatedP75} ms</span>
				</div>
				<div class="compare-cell good">
					<span class="compare-label">{m.showcase_obs_honesty_honest()}</span>
					<span class="compare-value">{data.contamination.honestP75} ms</span>
				</div>
			</div>

			<Alert variant="warning" description={m.showcase_obs_honesty_direction({ pct: String(delta) })} />
		</Stack>
	</Card>

	<Card>
		<Stack gap="3">
			<Typography variant="h2">{m.showcase_obs_honesty_fingerprint_title()}</Typography>
			<p>{m.showcase_obs_honesty_fingerprint_body()}</p>

			<Stack gap="2">
				<div class="sample">
					<span class="sample-tag dev">{m.perf_lane_dev()}</span>
					<code>{DEV_TARGET}</code>
				</div>
				<div class="sample">
					<span class="sample-tag prod">{m.perf_lane_prod()}</span>
					<code>{PROD_TARGET}</code>
				</div>
			</Stack>

			<p class="text-muted text-fluid-sm">{m.showcase_obs_honesty_fingerprint_note()}</p>
		</Stack>
	</Card>

	<Card>
		<Stack gap="3">
			<Stack gap="1">
				<Typography variant="h2">{m.showcase_obs_honesty_live_title()}</Typography>
				<p class="text-muted text-fluid-sm">{m.showcase_obs_honesty_live_desc()}</p>
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
							<span class="text-muted">({m.perf_sessions({ count: row.sessions })})</span>
						</span>
					{/each}
				</Cluster>
			{/if}
		</Stack>
	</Card>

	<Card>
		<Stack gap="3">
			<Typography variant="h2">{m.showcase_obs_honesty_rule_title()}</Typography>
			<p>{m.showcase_obs_honesty_rule_body()}</p>
			<ul class="rules">
				<li>{m.showcase_obs_honesty_rule_1()}</li>
				<li>{m.showcase_obs_honesty_rule_2()}</li>
				<li>{m.showcase_obs_honesty_rule_3()}</li>
			</ul>
		</Stack>
	</Card>
</Stack>

<style>
	.lead {
		font-size: var(--text-fluid-lg);
		max-width: 62ch;
	}

	.compare {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: var(--spacing-4);
	}

	.compare-cell {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding: var(--spacing-4);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
	}

	.compare-cell.bad {
		border-color: color-mix(in srgb, var(--color-error) 40%, transparent);
	}

	.compare-cell.good {
		border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
	}

	.compare-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.compare-value {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.sample {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.sample code {
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}

	.sample-tag {
		flex: none;
		padding: 0 var(--spacing-2);
		border-radius: var(--radius-sm);
		font-size: var(--text-fluid-xs);
		font-weight: 600;
	}

	.sample-tag.dev {
		background: color-mix(in srgb, var(--color-warning) 18%, transparent);
		color: var(--color-warning);
	}

	.sample-tag.prod {
		background: color-mix(in srgb, var(--color-success) 18%, transparent);
		color: var(--color-success);
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

	.rules {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding-left: var(--spacing-4);
		max-width: 68ch;
	}

	.rules li {
		list-style: disc;
	}
</style>
