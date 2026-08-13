<script lang="ts">
import { Alert, Card } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge, Typography } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const VERDICT_VARIANT = { pass: 'success', warn: 'warning', fail: 'error' } as const;

function verdictLabel(verdict: 'pass' | 'warn' | 'fail') {
	if (verdict === 'pass') return m.perf_verdict_pass();
	if (verdict === 'warn') return m.perf_verdict_warn();
	return m.perf_verdict_fail();
}
</script>

<Stack gap="6">
	<p class="lead">{m.showcase_obs_budgets_lead()}</p>

	{#if !data.scoreable}
		<Alert variant="error" description={m.admin_perf_lab_devmode({ env: data.nodeEnv })} />
	{/if}

	<!-- Targets -->
	<Card>
		<Stack gap="3">
			<Stack gap="1">
				<Typography variant="h2">{m.showcase_obs_budgets_target_title()}</Typography>
				<p class="text-muted text-fluid-sm">{m.showcase_obs_budgets_target_desc()}</p>
			</Stack>

			<div class="table-scroll">
				<table class="data-table">
					<thead>
						<tr>
							<th scope="col">{m.showcase_obs_budgets_col_metric()}</th>
							<th scope="col" class="num">{m.showcase_obs_budgets_col_current()}</th>
							<th scope="col" class="num">{m.showcase_obs_budgets_col_target()}</th>
							<th scope="col">{m.showcase_obs_budgets_col_verdict()}</th>
						</tr>
					</thead>
					<tbody>
						{#each data.scored as s (s.metric)}
							<tr>
								<th scope="row"><code>{s.metric}</code></th>
								<td class="num">{s.value} KB</td>
								<td class="num">{s.warn} / {s.fail}</td>
								<td><Badge variant={VERDICT_VARIANT[s.verdict]}>{verdictLabel(s.verdict)}</Badge></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<p class="text-muted text-fluid-sm">{m.showcase_obs_budgets_target_note()}</p>
		</Stack>
	</Card>

	<!-- Ratchets -->
	<Card>
		<Stack gap="3">
			<Stack gap="1">
				<Typography variant="h2">{m.showcase_obs_budgets_ratchet_title()}</Typography>
				<p class="text-muted text-fluid-sm">{m.showcase_obs_budgets_ratchet_desc()}</p>
			</Stack>

			<div class="table-scroll">
				<table class="data-table">
					<thead>
						<tr>
							<th scope="col">{m.showcase_obs_budgets_col_metric()}</th>
							<th scope="col" class="num">{m.showcase_obs_budgets_col_current()}</th>
							<th scope="col" class="num">{m.admin_perf_ratchet_col_ceiling()}</th>
							<th scope="col" class="num">{m.admin_perf_ratchet_col_slack()}</th>
						</tr>
					</thead>
					<tbody>
						{#each data.ratchets as r (r.metric)}
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
			</div>
		</Stack>
	</Card>

	<!-- The gate -->
	<Card>
		<Stack gap="3">
			<Typography variant="h2">{m.showcase_obs_budgets_gate_title()}</Typography>
			<p>{m.showcase_obs_budgets_gate_body()}</p>
			<ul class="rules">
				<li>{m.showcase_obs_budgets_gate_1()}</li>
				<li>{m.showcase_obs_budgets_gate_2()}</li>
				<li>{m.showcase_obs_budgets_gate_3()}</li>
			</ul>
			<p class="text-muted text-fluid-xs">
				{m.showcase_obs_overview_measured({ date: data.generatedAt.slice(0, 10), env: data.nodeEnv })}
			</p>
		</Stack>
	</Card>
</Stack>

<style>
	.lead {
		font-size: var(--text-fluid-lg);
		max-width: 62ch;
	}

	/* Tables scroll inside their own box rather than pushing the page sideways. */
	.table-scroll {
		overflow-x: auto;
		max-width: 100%;
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
		white-space: nowrap;
	}

	.data-table thead th {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.data-table tbody th {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
	}

	.data-table .num {
		text-align: right;
		font-variant-numeric: tabular-nums;
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
