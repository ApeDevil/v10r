<script lang="ts">
import { Tag } from '$lib/components/primitives/tag';
import * as m from '$lib/paraglide/messages';

let { data } = $props();

interface Row {
	table: string;
	icon: string;
	days: number | null;
	policy: string;
	rationale: string;
}

const rows: Row[] = [
	{
		table: 'analytics.events',
		icon: 'i-lucide-activity',
		days: data.retention.events,
		policy: 'Hard DELETE on daily cron',
		rationale: 'Individual page views, journey transitions. Past this window, only the daily aggregate row survives.',
	},
	{
		table: 'analytics.sessions',
		icon: 'i-lucide-users',
		days: data.retention.sessions,
		policy: 'Hard DELETE on daily cron',
		rationale:
			'Per-visit metadata: started_at, last_seen, consent_tier. Same retention as events to keep the join clean.',
	},
	{
		table: 'analytics.daily_page_stats',
		icon: 'i-lucide-bar-chart-3',
		days: data.retention.aggregates,
		policy: 'Hard DELETE on daily cron',
		rationale:
			'Pre-aggregated rollups (path / day / count). No individual visitor data — kept longer to draw long-term traffic trends.',
	},
	{
		table: 'analytics.consent_events',
		icon: 'i-lucide-clipboard-check',
		days: data.retention.consent,
		policy: 'Hard DELETE on daily cron',
		rationale:
			'Proof of consent (or its withdrawal). 13 months satisfies Art. 7(1) demonstrability without overshooting.',
	},
	{
		table: 'feedback.feedback',
		icon: 'i-lucide-message-square',
		days: null,
		policy: 'Manual deletion only',
		rationale:
			'User-authored content. We have no automatic expiry; you can request removal at any time and the operator deletes the row.',
	},
	{
		table: 'auth.session',
		icon: 'i-lucide-key',
		days: null,
		policy: 'Better Auth session expiry',
		rationale: 'Sessions expire on their own per Better Auth config. Logout invalidates immediately.',
	},
];

function fmtDays(days: number | null): string {
	if (days === null) return '—';
	if (days >= 365) return `${days} days (~${Math.round((days / 365) * 10) / 10} years)`;
	if (days >= 30) return `${days} days (~${Math.round(days / 30)} months)`;
	return `${days} days`;
}

function relativeTime(ts: string | Date | null): string {
	if (!ts) return 'never';
	const date = typeof ts === 'string' ? new Date(ts) : ts;
	const diff = Date.now() - date.getTime();
	const hours = Math.floor(diff / 3_600_000);
	if (hours < 1) {
		const mins = Math.floor(diff / 60_000);
		return `${mins} minute${mins === 1 ? '' : 's'} ago`;
	}
	if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
	const days = Math.floor(hours / 24);
	return `${days} day${days === 1 ? '' : 's'} ago`;
}

function jobOverdue(ts: string | Date | null, hoursThreshold: number): boolean {
	if (!ts) return true;
	const date = typeof ts === 'string' ? new Date(ts) : ts;
	return Date.now() - date.getTime() > hoursThreshold * 3_600_000;
}
</script>
<div class="retention">
	<header class="lede">
		<h2>{m.showcase_admin_retention_heading()}</h2>
		<p>
			GDPR Art. 5(1)(e) says personal data must be kept "no longer than is necessary." Below is the live
			retention table, sourced from <code>src/lib/server/config.ts</code>, and the timestamps of the cron
			jobs that enforce it. If the schedule slips, this page is the proof.
		</p>
	</header>

	<section class="table-section">
		<header class="section-head">
			<h3>{m.showcase_admin_retention_section_table()}</h3>
			<Tag variant="muted" size="sm" label="Live values" />
		</header>

		<div class="retention-table-wrapper">
			<table class="retention-table">
				<thead>
					<tr>
						<th>{m.showcase_admin_retention_col_table()}</th>
						<th>{m.showcase_admin_retention_col_window()}</th>
						<th>{m.showcase_admin_retention_col_policy()}</th>
						<th>{m.showcase_admin_retention_col_rationale()}</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row}
						<tr>
							<td>
								<span class="table-name">
									<span class="table-icon {row.icon}" aria-hidden="true"></span>
									<code>{row.table}</code>
								</span>
							</td>
							<td><strong class="window">{fmtDays(row.days)}</strong></td>
							<td>{row.policy}</td>
							<td><span class="rationale">{row.rationale}</span></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="cron-section">
		<header class="section-head">
			<h3>{m.showcase_admin_retention_section_cron()}</h3>
			<Tag variant="muted" size="sm" label="Live" />
		</header>

		{#await data.jobs}
			<div class="cron-grid">
				<div class="cron-card pending">
					<span class="cron-icon i-lucide-loader text-icon-sm" aria-hidden="true"></span>
					<div>
						<h4>Loading…</h4>
					</div>
				</div>
			</div>
		{:then jobs}
			{@const cleanupOverdue = jobOverdue(jobs.cleanup?.startedAt ?? null, 26)}
			{@const rollupOverdue = jobOverdue(jobs.rollup?.startedAt ?? null, 26)}
			<div class="cron-grid">
				<article class="cron-card" class:warn={cleanupOverdue} class:fail={jobs.cleanup?.status === 'failure'}>
					<span
						class="cron-icon {jobs.cleanup?.status === 'failure'
							? 'i-lucide-x-circle'
							: cleanupOverdue
								? 'i-lucide-alert-triangle'
								: 'i-lucide-check-circle'}"
						aria-hidden="true"
					></span>
					<div class="cron-body">
						<h4>analytics-cleanup</h4>
						<p class="cron-detail">Daily at 02:00 UTC — deletes rows past the windows above.</p>
						<dl>
							<dt>Last run</dt>
							<dd>{relativeTime(jobs.cleanup?.startedAt ?? null)}</dd>
							<dt>Status</dt>
							<dd>
								{#if jobs.cleanup}
									<Tag
										variant={jobs.cleanup.status === 'failure' ? 'error' : 'success'}
										size="sm"
										label={jobs.cleanup.status ?? 'unknown'}
									/>
								{:else}
									<span class="muted">never run</span>
								{/if}
							</dd>
							<dt>Rows removed</dt>
							<dd>{jobs.cleanup?.resultCount ?? '—'}</dd>
						</dl>
					</div>
				</article>

				<article class="cron-card" class:warn={rollupOverdue} class:fail={jobs.rollup?.status === 'failure'}>
					<span
						class="cron-icon {jobs.rollup?.status === 'failure'
							? 'i-lucide-x-circle'
							: rollupOverdue
								? 'i-lucide-alert-triangle'
								: 'i-lucide-check-circle'}"
						aria-hidden="true"
					></span>
					<div class="cron-body">
						<h4>analytics-rollup</h4>
						<p class="cron-detail">Daily at 02:30 UTC — collapses raw events into daily_page_stats.</p>
						<dl>
							<dt>Last run</dt>
							<dd>{relativeTime(jobs.rollup?.startedAt ?? null)}</dd>
							<dt>Status</dt>
							<dd>
								{#if jobs.rollup}
									<Tag
										variant={jobs.rollup.status === 'failure' ? 'error' : 'success'}
										size="sm"
										label={jobs.rollup.status ?? 'unknown'}
									/>
								{:else}
									<span class="muted">never run</span>
								{/if}
							</dd>
							<dt>Rows aggregated</dt>
							<dd>{jobs.rollup?.resultCount ?? '—'}</dd>
						</dl>
					</div>
				</article>
			</div>
		{/await}
	</section>

	<section class="explainer">
		<h3>{m.showcase_admin_retention_section_lifecycle()}</h3>
		<ol class="death-flow">
			<li>
				<strong>Daily at 02:00 UTC</strong> Vercel Cron pings <code>/api/cron/analytics-cleanup</code> with a Bearer token.
			</li>
			<li>
				The job computes today's cutoffs from <code>ANALYTICS_RETENTION_DAYS</code> and <code>CONSENT_RETENTION_DAYS</code>.
			</li>
			<li>
				A single <code>DELETE</code> per table removes everything older than the cutoff. No soft delete, no archival
				bucket — the row is gone.
			</li>
			<li>
				The run is recorded in <code>jobs.job_executions</code> with rows-deleted, status, duration. That table is
				what this page reads.
			</li>
			<li>
				If the schedule slips beyond 26 hours, the badges above flip to "overdue" and the
				<a href="/admin/analytics">/admin/analytics</a> tile flags it too.
			</li>
		</ol>
	</section>
</div>

<style>
	.retention {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-7);
	}

	.lede h2 {
		margin: 0 0 var(--spacing-2) 0;
		font-size: var(--text-fluid-xl);
		font-weight: 600;
		color: var(--color-fg);
	}

	.lede p {
		margin: 0;
		max-width: 65ch;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.lede code,
	.explainer code {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
		padding: 0.1em 0.35em;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
		color: var(--color-fg);
	}

	.section-head {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		margin-bottom: var(--spacing-4);
	}

	.section-head h3 {
		margin: 0;
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		color: var(--color-fg);
	}

	.retention-table-wrapper {
		overflow-x: auto;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		background: var(--surface-1);
	}

	.retention-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.retention-table thead {
		background: var(--color-subtle);
	}

	.retention-table th {
		text-align: left;
		padding: var(--spacing-3) var(--spacing-4);
		font-weight: 600;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		border-bottom: 1px solid var(--color-border);
	}

	.retention-table td {
		padding: var(--spacing-4);
		border-bottom: 1px solid var(--color-border);
		vertical-align: top;
		color: var(--color-fg);
		line-height: 1.5;
	}

	.retention-table tr:last-child td {
		border-bottom: none;
	}

	.table-name {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.table-name code {
		font-family: ui-monospace, monospace;
		font-weight: 600;
		color: var(--color-fg);
	}

	.table-icon {
		width: 1rem;
		height: 1rem;
		color: var(--color-primary);
	}

	.window {
		font-variant-numeric: tabular-nums;
		color: var(--color-fg);
	}

	.rationale {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.55;
	}

	.cron-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--spacing-4);
	}

	@media (max-width: 768px) {
		.cron-grid {
			grid-template-columns: 1fr;
		}
	}

	.cron-card {
		display: flex;
		gap: var(--spacing-4);
		padding: var(--spacing-5);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
	}

	.cron-card.warn {
		border-color: var(--color-warning);
		background: color-mix(in srgb, var(--color-warning) 6%, var(--surface-1));
	}

	.cron-card.fail {
		border-color: var(--color-error);
		background: color-mix(in srgb, var(--color-error) 6%, var(--surface-1));
	}

	.cron-card.pending {
		opacity: 0.6;
	}

	.cron-icon {
		flex-shrink: 0;
		width: 1.25rem;
		height: 1.25rem;
		margin-top: 0.15rem;
		color: var(--color-success);
	}

	.cron-card.warn .cron-icon {
		color: var(--color-warning);
	}

	.cron-card.fail .cron-icon {
		color: var(--color-error);
	}

	.cron-body {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		flex: 1;
	}

	.cron-body h4 {
		margin: 0;
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
	}

	.cron-detail {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.cron-body dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--spacing-1) var(--spacing-3);
		margin: var(--spacing-2) 0 0 0;
		font-size: var(--text-fluid-xs);
	}

	.cron-body dt {
		font-weight: 500;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.cron-body dd {
		margin: 0;
		color: var(--color-fg);
		font-variant-numeric: tabular-nums;
	}

	.cron-body dd .muted {
		color: var(--color-muted);
	}

	.explainer h3 {
		margin: 0 0 var(--spacing-3) 0;
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		color: var(--color-fg);
	}

	.death-flow {
		margin: 0;
		padding-left: var(--spacing-5);
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		line-height: 1.7;
	}

	.death-flow li + li {
		margin-top: var(--spacing-2);
	}

	.death-flow strong {
		color: var(--color-fg);
	}

	.death-flow a {
		color: var(--color-primary);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
</style>
