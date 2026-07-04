<script lang="ts">
import { invalidateAll } from '$app/navigation';
import { Card, EmptyState } from '$lib/components/composites';
import { Cluster } from '$lib/components/layout';
import { Badge, Button } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { RunStatus } from '$lib/server/dbops';

let { data } = $props();

let expandedError = $state<string | null>(null);

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

function statusVariant(s: RunStatus): 'default' | 'success' | 'error' | 'warning' | 'secondary' {
	if (s === 'succeeded') return 'success';
	if (s === 'failed') return 'error';
	if (s === 'canceled') return 'secondary';
	return 'warning';
}

function statusLabel(s: RunStatus): string {
	if (s === 'succeeded') return m.admin_dbops_status_succeeded();
	if (s === 'failed') return m.admin_dbops_status_failed();
	if (s === 'canceled') return m.admin_dbops_status_canceled();
	if (s === 'queued') return m.admin_dbops_status_queued();
	return m.admin_dbops_status_running();
}

function triggerVariant(t: string): 'default' | 'secondary' | 'warning' {
	return t === 'manual' ? 'warning' : 'default';
}
</script>

<Card>
	{#snippet header()}
		<Cluster justify="between" align="center">
			<h2 class="text-fluid-lg font-semibold">{m.admin_dbops_runs_heading()}</h2>
			<Button variant="outline" size="sm" onclick={() => invalidateAll()}>
				<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
				{m.admin_action_refresh()}
			</Button>
		</Cluster>
	{/snippet}

	{#if data.history.length === 0}
		<EmptyState
			icon="i-lucide-history"
			title={m.admin_dbops_runs_empty_title()}
			description={m.admin_dbops_runs_empty_desc()}
		/>
	{:else}
		<div class="history-table-wrap" tabindex="0" aria-label={m.admin_dbops_runs_heading()}>
			<table class="history-table">
				<thead>
					<tr>
						<th>{m.admin_dbops_col_kind()}</th>
						<th>{m.admin_dbops_col_status()}</th>
						<th>{m.admin_dbops_col_trigger()}</th>
						<th>{m.admin_dbops_col_actor()}</th>
						<th>{m.admin_dbops_col_duration()}</th>
						<th>{m.admin_dbops_col_ops()}</th>
						<th>{m.admin_dbops_col_time()}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.history as row (row.id)}
						<tr
							class:error-row={row.status === 'failed'}
							class:clickable={!!row.errorMessage}
							onclick={() => {
								if (row.errorMessage) expandedError = expandedError === row.id ? null : row.id;
							}}
							onkeydown={(e) => {
								if (row.errorMessage && (e.key === 'Enter' || e.key === ' ')) {
									expandedError = expandedError === row.id ? null : row.id;
								}
							}}
							tabindex={row.errorMessage ? 0 : -1}
							role={row.errorMessage ? 'button' : undefined}
						>
							<td><code>{row.kind}</code></td>
							<td><Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge></td>
							<td><Badge variant={triggerVariant(row.trigger)}>{row.trigger}</Badge></td>
							<td class="actor-cell">{row.actorEmail}</td>
							<td><code>{row.durationMs !== null ? `${row.durationMs}ms` : '—'}</code></td>
							<td>{row.neonOpCount}</td>
							<td class="time-cell">{relativeTime(row.createdAt)}</td>
						</tr>
						{#if row.errorMessage && expandedError === row.id}
							<tr class="error-detail-row">
								<td colspan="7">
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

		{#if data.totalPages > 1}
			<div class="pagination">
				{#if data.page > 1}
					<a href="/admin/db/runs?page={data.page - 1}" class="page-link">
						<span class="i-lucide-chevron-left h-4 w-4"></span> {m.admin_jobs_pagination_prev()}
					</a>
				{/if}
				<span class="page-info">{m.admin_jobs_pagination_info({ page: data.page, total: data.totalPages })}</span>
				{#if data.page < data.totalPages}
					<a href="/admin/db/runs?page={data.page + 1}" class="page-link">
						{m.admin_jobs_pagination_next()} <span class="i-lucide-chevron-right h-4 w-4"></span>
					</a>
				{/if}
			</div>
		{/if}
	{/if}
</Card>

<style>
	.history-table-wrap {
		overflow-x: auto;
	}

	.history-table-wrap:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
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

	.actor-cell {
		color: var(--color-muted);
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
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
