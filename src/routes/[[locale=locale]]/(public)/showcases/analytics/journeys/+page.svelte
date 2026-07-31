<script lang="ts">
import { page } from '$app/state';
import { Alert, EmptyState } from '$lib/components/composites';
import { getFormattingLocale } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { baseLocale, extractLocaleFromUrl } from '$lib/paraglide/runtime';
import ChartSection from '../_components/ChartSection.svelte';
import QueryTime from '../_components/QueryTime.svelte';

let { data } = $props();

// Bar width is relative to the busiest transition, so the column reads as a
// ranking rather than as an absolute volume claim.
const maxTransition = $derived(Math.max(1, ...data.transitions.map((t) => t.count)));
const maxEntry = $derived(Math.max(1, ...data.entryPages.map((p) => p.count)));
const maxExit = $derived(Math.max(1, ...data.exitPages.map((p) => p.count)));

const formattingLocale = $derived(getFormattingLocale(extractLocaleFromUrl(page.url.href) ?? baseLocale));

function formatDate(d: Date): string {
	return d.toLocaleDateString(formattingLocale, {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}
</script>

<div class="journeys-layout">
	{#if data.error}
		<Alert variant="error" title={m.showcase_analytics_shared_error_title()}>
			<p>{data.error}</p>
		</Alert>
	{/if}

	<ChartSection
		title={m.showcase_analytics_journeys_chart_flows()}
		description={m.showcase_analytics_journeys_desc_transitions()}
	>
		{#snippet chart()}
			{#if data.transitions.length > 0}
				<div class="transition-list">
					{#each data.transitions as t (`${t.source}→${t.target}`)}
						<div class="transition-row">
							<div class="transition-pair">
								<code class="page-path">{t.source}</code>
								<span class="arrow" aria-hidden="true">→</span>
								<code class="page-path">{t.target}</code>
							</div>
							<div class="transition-bar-track" aria-hidden="true">
								<div class="transition-bar" style="width: {(t.count / maxTransition) * 100}%"></div>
							</div>
							<span class="page-count">{t.count}</span>
						</div>
					{/each}
				</div>
				<p class="method-note">
					{m.showcase_analytics_journeys_method_note()}
				</p>
			{:else}
				<EmptyState
					icon="i-lucide-route"
					title={m.showcase_analytics_journeys_empty_transitions_title()}
					description={m.showcase_analytics_journeys_empty_transitions_desc()}
				/>
			{/if}
		{/snippet}
	</ChartSection>

	<div class="entry-exit-grid">
		<ChartSection title={m.showcase_analytics_journeys_chart_entry()} description={m.showcase_analytics_journeys_desc_entry()}>
			{#snippet chart()}
				{#if data.entryPages.length > 0}
					<div class="page-list">
						{#each data.entryPages as entryPage (entryPage.path)}
							<div class="page-row">
								<code class="page-path">{entryPage.path}</code>
								<div class="transition-bar-track" aria-hidden="true">
									<div class="transition-bar" style="width: {(entryPage.count / maxEntry) * 100}%"></div>
								</div>
								<span class="page-count">{entryPage.count}</span>
							</div>
						{/each}
					</div>
				{:else}
					<EmptyState icon="i-lucide-log-in" title={m.showcase_analytics_journeys_empty_sessions_title()} />
				{/if}
			{/snippet}
		</ChartSection>

		<ChartSection title={m.showcase_analytics_journeys_chart_exit()} description={m.showcase_analytics_journeys_desc_exit()}>
			{#snippet chart()}
				{#if data.exitPages.length > 0}
					<div class="page-list">
						{#each data.exitPages as exitPage (exitPage.path)}
							<div class="page-row">
								<code class="page-path">{exitPage.path}</code>
								<div class="transition-bar-track" aria-hidden="true">
									<div class="transition-bar" style="width: {(exitPage.count / maxExit) * 100}%"></div>
								</div>
								<span class="page-count">{exitPage.count}</span>
							</div>
						{/each}
					</div>
				{:else}
					<EmptyState icon="i-lucide-log-out" title={m.showcase_analytics_journeys_empty_sessions_title()} />
				{/if}
			{/snippet}
		</ChartSection>
	</div>

	<ChartSection
		title={m.showcase_analytics_journeys_chart_sessions()}
		description={m.showcase_analytics_journeys_desc_sessions()}
	>
		{#snippet chart()}
			<div class="sessions-table-wrapper">
				<table class="sessions-table" aria-label={m.showcase_analytics_journeys_aria_sessions_table()}>
					<thead>
						<tr>
							<th scope="col">{m.showcase_analytics_journeys_col_session()}</th>
							<th scope="col">{m.showcase_analytics_journeys_col_pages()}</th>
							<th scope="col">{m.showcase_analytics_journeys_col_entry()}</th>
							<th scope="col">{m.showcase_analytics_journeys_col_exit()}</th>
							<th scope="col">{m.showcase_analytics_journeys_col_device()}</th>
							<th scope="col">{m.showcase_analytics_journeys_col_country()}</th>
							<th scope="col">{m.showcase_analytics_journeys_col_started()}</th>
						</tr>
					</thead>
					<tbody>
						{#each data.sessions as session (session.id)}
							<tr>
								<td><code class="session-id">{session.id.slice(0, 12)}</code></td>
								<td class="numeric">{session.pageCount}</td>
								<td><code>{session.entryPath}</code></td>
								<td><code>{session.exitPath ?? '—'}</code></td>
								<td>{session.device ?? '—'}</td>
								<td>{session.country ?? '—'}</td>
								<td class="timestamp">{formatDate(session.startedAt)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/snippet}
	</ChartSection>

	<QueryTime ms={data.queryMs} />
</div>

<style>
	.journeys-layout {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.entry-exit-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-6);
	}

	@media (max-width: 768px) {
		.entry-exit-grid {
			grid-template-columns: 1fr;
		}
	}

	.transition-list,
	.page-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.transition-row,
	.page-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 6rem auto;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.transition-pair {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		min-width: 0;
		overflow-x: auto;
	}

	.arrow {
		color: var(--color-muted);
		flex-shrink: 0;
	}

	.transition-bar-track {
		height: 6px;
		border-radius: var(--radius-full);
		background: var(--color-border);
		overflow: hidden;
	}

	.transition-bar {
		height: 100%;
		border-radius: var(--radius-full);
		background: var(--color-primary);
	}

	.page-path {
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		white-space: nowrap;
	}

	.page-count {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}

	.method-note {
		margin-top: var(--spacing-4);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.sessions-table-wrapper {
		overflow-x: auto;
	}

	.sessions-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.sessions-table th {
		text-align: left;
		padding: var(--spacing-2) var(--spacing-3);
		font-weight: 600;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.sessions-table td {
		padding: var(--spacing-2) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
		color: var(--color-fg);
		white-space: nowrap;
	}

	.sessions-table .numeric {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.sessions-table .timestamp {
		color: var(--color-muted);
	}

	.session-id {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
</style>
