<script lang="ts">
import { Card, EmptyState, PageHeader } from '$lib/components/composites';
import { PageContainer, Stack } from '$lib/components/layout';
import { Badge } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';

let { data } = $props();

function relativeTime(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}
</script>
<PageContainer class="py-7">
	<PageHeader
		title={m.showcase_jobs_title()}
		description={m.showcase_jobs_description()}
		breadcrumbs={[
			{ label: m.showcase_breadcrumb_home(), href: '/' },
			{ label: m.showcase_breadcrumb_showcases(), href: '/showcases' },
			{ label: m.showcase_jobs_breadcrumb() }
		]}
	/>

	<Stack gap="6">
		<!-- How it works -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_jobs_section_how()}</h2>
			{/snippet}

			<div class="explanation">
				<p>Jobs are registered in a central registry and executed via three triggers:</p>
				<div class="diag-grid">
					<div class="diag-row">
						<span class="diag-label">Cron (HTTP)</span>
						<span class="diag-value">Vercel cron hits <code class="diag-mono">/api/cron/[job]</code></span>
					</div>
					<div class="diag-row">
						<span class="diag-label">Scheduler</span>
						<span class="diag-value">setInterval in persistent containers</span>
					</div>
					<div class="diag-row">
						<span class="diag-label">Manual</span>
						<span class="diag-value">Admin dashboard at <code class="diag-mono">/admin/jobs</code></span>
					</div>
				</div>
				<p>Every execution is logged to PostgreSQL with status, duration, trigger type, and result count. The <code>runJob()</code> wrapper handles timing and fire-and-forget logging — if the DB insert fails, the job result is still returned.</p>
			</div>
		</Card>

		<!-- Registered Jobs -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_jobs_section_registered()}</h2>
			{/snippet}

			<div class="diag-grid">
				{#each data.registeredJobs as slug}
					<div class="diag-row">
						<code class="diag-mono">{slug}</code>
						<Badge variant="secondary">registered</Badge>
					</div>
				{:else}
					<p class="empty-text">No jobs registered.</p>
				{/each}
			</div>
		</Card>

		<!-- Recent Executions -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_jobs_section_recent()}</h2>
			{/snippet}

			{#if data.recentExecutions.length === 0}
				<EmptyState
					icon="i-lucide-history"
					title={m.showcase_jobs_empty_title()}
					description={m.showcase_jobs_empty_description()}
				/>
			{:else}
				<div class="history-table-wrap">
					<table class="history-table">
						<thead>
							<tr>
								<th>{m.showcase_jobs_col_job()}</th>
								<th>{m.showcase_jobs_col_status()}</th>
								<th>{m.showcase_jobs_col_trigger()}</th>
								<th>{m.showcase_jobs_col_duration()}</th>
								<th>{m.showcase_jobs_col_result()}</th>
								<th>{m.showcase_jobs_col_time()}</th>
							</tr>
						</thead>
						<tbody>
							{#each data.recentExecutions as row}
								<tr class:error-row={row.status === 'failure'}>
									<td><code>{row.jobSlug}</code></td>
									<td>
										<Badge variant={row.status === 'success' ? 'success' : 'error'}>
											{row.status}
										</Badge>
									</td>
									<td>
										<Badge variant="secondary">{row.trigger}</Badge>
									</td>
									<td><code>{row.durationMs}ms</code></td>
									<td>{row.resultCount ?? '—'}</td>
									<td class="time-cell">{relativeTime(row.startedAt)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</Card>

		<!-- Architecture -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_jobs_section_files()}</h2>
			{/snippet}

			<div class="diag-grid">
				<div class="diag-row">
					<span class="diag-label">Registry</span>
					<code class="diag-mono">src/lib/server/jobs/index.ts</code>
				</div>
				<div class="diag-row">
					<span class="diag-label">Runner</span>
					<code class="diag-mono">src/lib/server/jobs/runner.ts</code>
				</div>
				<div class="diag-row">
					<span class="diag-label">Scheduler</span>
					<code class="diag-mono">src/lib/server/jobs/scheduler.ts</code>
				</div>
				<div class="diag-row">
					<span class="diag-label">Cron route</span>
					<code class="diag-mono">src/routes/api/cron/[job]/+server.ts</code>
				</div>
				<div class="diag-row">
					<span class="diag-label">Schema</span>
					<code class="diag-mono">src/lib/server/db/schema/jobs/job-execution.ts</code>
				</div>
				<div class="diag-row">
					<span class="diag-label">Admin</span>
					<code class="diag-mono">src/routes/admin/jobs/+page.svelte</code>
				</div>
			</div>
		</Card>
	</Stack>
</PageContainer>

<style>
	.diag-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.diag-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
	}

	.diag-row:nth-child(odd) {
		background: var(--color-subtle);
	}

	.diag-label {
		font-weight: 500;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.diag-value {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-sm);
	}

	.diag-mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}

	.explanation {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.explanation p {
		margin: 0;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
	}

	.empty-text {
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		margin: 0;
		padding: var(--spacing-2) var(--spacing-3);
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

	.time-cell {
		color: var(--color-muted);
	}
</style>
