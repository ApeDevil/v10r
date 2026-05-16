<script lang="ts">
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { Card, EmptyState } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Spinner } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { getToast } from '$lib/state/toast.svelte';

let { data } = $props();
const toast = getToast();

let triggeringSlug = $state('');
let expandedError = $state<number | null>(null);

function relativeTime(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return m.admin_jobs_time_just_now();
	if (mins < 60) return m.admin_jobs_time_mins_ago({ mins });
	const hours = Math.floor(mins / 60);
	if (hours < 24) return m.admin_jobs_time_hours_ago({ hours });
	const days = Math.floor(hours / 24);
	return m.admin_jobs_time_days_ago({ days });
}

function healthVariant(slug: string): 'success' | 'error' | 'secondary' {
	const stat = data.stats.find((s) => s.jobSlug === slug);
	if (!stat) return 'secondary';
	return stat.lastStatus === 'success' ? 'success' : 'error';
}

function healthLabel(slug: string): string {
	const stat = data.stats.find((s) => s.jobSlug === slug);
	if (!stat) return m.admin_jobs_health_never_ran();
	return stat.lastStatus === 'success' ? m.admin_jobs_health_healthy() : m.admin_jobs_health_failed();
}

function triggerVariant(trigger: string): 'default' | 'secondary' | 'warning' {
	if (trigger === 'cron') return 'default';
	if (trigger === 'manual') return 'warning';
	return 'secondary';
}
</script>
<Stack gap="6">
	<!-- Registered Jobs -->
	<Card>
		{#snippet header()}
			<Cluster justify="between">
				<h2 class="text-fluid-lg font-semibold">{m.admin_jobs_registered_heading()}</h2>
				<Button variant="outline" size="sm" onclick={() => invalidateAll()}>
					<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
					{m.admin_action_refresh()}
				</Button>
			</Cluster>
		{/snippet}

		{#if data.registeredJobs.length === 0}
			<EmptyState
				icon="i-lucide-calendar-x"
				title={m.admin_jobs_empty_title()}
				description={m.admin_jobs_empty_description()}
			/>
		{:else}
			<div class="job-cards">
				{#each data.registeredJobs as slug}
					{@const stat = data.stats.find((s) => s.jobSlug === slug)}
					<div class="job-card">
						<div class="job-card-header">
							<Cluster gap="2" align="center">
								<span class="health-dot health-dot--{healthVariant(slug)}"></span>
								<span class="job-name">{slug}</span>
							</Cluster>
							<Badge variant={healthVariant(slug)}>{healthLabel(slug)}</Badge>
						</div>

						<div class="job-card-stats">
							{#if stat}
								<div class="job-stat">
									<span class="job-stat-label">{m.admin_jobs_stat_last_run()}</span>
									<span class="job-stat-value">{relativeTime(stat.lastRun!.toISOString())}</span>
								</div>
								<div class="job-stat">
									<span class="job-stat-label">{m.admin_jobs_stat_duration()}</span>
									<span class="job-stat-value">{stat.lastDuration}ms</span>
								</div>
								<div class="job-stat">
									<span class="job-stat-label">{m.admin_jobs_stat_result()}</span>
									<span class="job-stat-value">{stat.lastResultCount ?? '—'}</span>
								</div>
								<div class="job-stat">
									<span class="job-stat-label">{m.admin_jobs_stat_total_runs()}</span>
									<span class="job-stat-value">{stat.totalRuns}</span>
								</div>
							{:else}
								<p class="no-runs">{m.admin_jobs_no_executions()}</p>
							{/if}
						</div>

						<form
							method="POST"
							action="?/trigger"
							use:enhance={() => {
								triggeringSlug = slug;
								return async ({ result, update }) => {
									if (result.type === 'success' && result.data) {
										toast.success(result.data.message as string);
									} else if (result.type === 'failure') {
										toast.error((result.data?.message as string) || m.admin_jobs_toast_failed());
									}
									triggeringSlug = '';
									return update();
								};
							}}
						>
							<input type="hidden" name="slug" value={slug} />
							<Button
								type="submit"
								variant="outline"
								size="sm"
								disabled={triggeringSlug === slug}
							>
								{#if triggeringSlug === slug}
									<Spinner size="xs" class="mr-1" />
								{/if}
								<span class="i-lucide-play h-3 w-3 mr-1"></span>
								{m.admin_jobs_run_now()}
							</Button>
						</form>
					</div>
				{/each}
			</div>
		{/if}
	</Card>

	<!-- Execution History -->
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">{m.admin_jobs_history_heading()}</h2>
				{#if data.registeredJobs.length > 1}
					<div class="filter-bar">
						<a
							href="/admin/jobs?job=all"
							class="filter-link"
							class:active={data.jobFilter === 'all'}
						>{m.admin_filter_all()}</a>
						{#each data.registeredJobs as slug}
							<a
								href="/admin/jobs?job={slug}"
								class="filter-link"
								class:active={data.jobFilter === slug}
							>{slug}</a>
						{/each}
					</div>
				{/if}
			</Cluster>
		{/snippet}

		{#if data.history.length === 0}
			<EmptyState
				icon="i-lucide-history"
				title={m.admin_jobs_history_empty_title()}
				description={m.admin_jobs_history_empty_description()}
			>
				{#if data.registeredJobs.length > 0}
					<form
						method="POST"
						action="?/trigger"
						use:enhance={() => {
							triggeringSlug = data.registeredJobs[0];
							return async ({ result, update }) => {
								if (result.type === 'success' && result.data) {
									toast.success(result.data.message as string);
								} else if (result.type === 'failure') {
									toast.error((result.data?.message as string) || m.admin_jobs_toast_failed());
								}
								triggeringSlug = '';
								return update();
							};
						}}
					>
						<input type="hidden" name="slug" value={data.registeredJobs[0]} />
						<Button type="submit" variant="outline" disabled={!!triggeringSlug}>
							{#if triggeringSlug}
								<Spinner size="xs" class="mr-1" />
							{/if}
							{m.admin_jobs_run_named({ slug: data.registeredJobs[0] })}
						</Button>
					</form>
				{/if}
			</EmptyState>
		{:else}
			<div class="history-table-wrap">
				<table class="history-table">
					<thead>
						<tr>
							<th>{m.admin_jobs_col_job()}</th>
							<th>{m.admin_jobs_col_status()}</th>
							<th>{m.admin_jobs_col_trigger()}</th>
							<th>{m.admin_jobs_col_duration()}</th>
							<th>{m.admin_jobs_col_result()}</th>
							<th>{m.admin_jobs_col_time()}</th>
						</tr>
					</thead>
					<tbody>
						{#each data.history as row}
							<tr
								class:error-row={row.status === 'failure'}
								class:clickable={!!row.errorMessage}
								onclick={() => {
									if (row.errorMessage) {
										expandedError = expandedError === row.id ? null : row.id;
									}
								}}
								onkeydown={(e) => {
									if (row.errorMessage && (e.key === 'Enter' || e.key === ' ')) {
										expandedError = expandedError === row.id ? null : row.id;
									}
								}}
								tabindex={row.errorMessage ? 0 : -1}
								role={row.errorMessage ? 'button' : undefined}
							>
								<td><code>{row.jobSlug}</code></td>
								<td>
									<Badge variant={row.status === 'success' ? 'success' : 'error'}>
										{row.status}
									</Badge>
								</td>
								<td>
									<Badge variant={triggerVariant(row.trigger)}>
										{row.trigger}
									</Badge>
								</td>
								<td><code>{row.durationMs}ms</code></td>
								<td>{row.resultCount ?? '—'}</td>
								<td class="time-cell">{relativeTime(row.startedAt)}</td>
							</tr>
							{#if row.errorMessage && expandedError === row.id}
								<tr class="error-detail-row">
									<td colspan="6">
										<div class="error-detail">
											<span class="i-lucide-alert-triangle h-4 w-4 error-icon"></span>
											<code>{row.errorMessage}</code>
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			{#if data.totalPages > 1}
				<div class="pagination">
					{#if data.page > 1}
						<a href="/admin/jobs?page={data.page - 1}&job={data.jobFilter}" class="page-link">
							<span class="i-lucide-chevron-left h-4 w-4"></span> {m.admin_jobs_pagination_prev()}
						</a>
					{/if}
					<span class="page-info">{m.admin_jobs_pagination_info({ page: data.page, total: data.totalPages })}</span>
					{#if data.page < data.totalPages}
						<a href="/admin/jobs?page={data.page + 1}&job={data.jobFilter}" class="page-link">
							{m.admin_jobs_pagination_next()} <span class="i-lucide-chevron-right h-4 w-4"></span>
						</a>
					{/if}
				</div>
			{/if}
		{/if}
	</Card>
</Stack>

<style>
	/* Job Cards */
	.job-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--spacing-4);
	}

	.job-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.job-card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.health-dot {
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
	}

	.health-dot--success {
		background: var(--color-success);
	}

	.health-dot--error {
		background: var(--color-error);
	}

	.health-dot--secondary {
		background: var(--color-muted);
	}

	.job-name {
		font-weight: 600;
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
	}

	.job-card-stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-1);
	}

	.job-stat {
		display: flex;
		flex-direction: column;
	}

	.job-stat-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.job-stat-value {
		font-size: var(--text-fluid-sm);
		font-family: ui-monospace, monospace;
	}

	.no-runs {
		grid-column: 1 / -1;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		margin: 0;
	}

	/* History Table */
	.history-table-wrap {
		overflow-x: auto;
	}

	.history-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.history-table th {
		text-align: left;
		padding: var(--spacing-2) var(--spacing-3);
		font-weight: 600;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.history-table td {
		padding: var(--spacing-2) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.history-table tbody tr:hover {
		background: var(--color-subtle);
	}

	.error-row {
		background: color-mix(in srgb, var(--color-error) 5%, transparent);
	}

	.clickable {
		cursor: pointer;
	}

	.time-cell {
		color: var(--color-muted);
	}

	.error-detail-row td {
		padding: 0 var(--spacing-3) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
	}

	.error-detail {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		background: color-mix(in srgb, var(--color-error) 8%, transparent);
		border-radius: var(--radius-sm);
		font-size: var(--text-fluid-xs);
	}

	.error-icon {
		color: var(--color-error);
		flex-shrink: 0;
		margin-top: 2px;
	}

	.error-detail code {
		font-family: ui-monospace, monospace;
		word-break: break-all;
		white-space: pre-wrap;
	}

	/* Filter */
	.filter-bar {
		display: flex;
		gap: var(--spacing-1);
		flex-wrap: wrap;
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

	/* Pagination */
	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: var(--spacing-4);
		padding-top: var(--spacing-4);
		border-top: 1px solid var(--color-border);
		margin-top: var(--spacing-4);
	}

	.page-link {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		font-size: var(--text-fluid-sm);
		color: var(--color-primary);
		text-decoration: none;
	}

	.page-link:hover {
		text-decoration: underline;
	}

	.page-info {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}
</style>
