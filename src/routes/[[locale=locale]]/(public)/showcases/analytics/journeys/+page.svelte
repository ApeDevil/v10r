<script lang="ts">
import { Alert, EmptyState } from '$lib/components/composites';
import ChartSection from '../_components/ChartSection.svelte';
import QueryTime from '../_components/QueryTime.svelte';

let { data } = $props();

// Bar width is relative to the busiest transition, so the column reads as a
// ranking rather than as an absolute volume claim.
const maxTransition = $derived(Math.max(1, ...data.transitions.map((t) => t.count)));
const maxEntry = $derived(Math.max(1, ...data.entryPages.map((p) => p.count)));
const maxExit = $derived(Math.max(1, ...data.exitPages.map((p) => p.count)));

function formatDate(d: Date): string {
	return d.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}
</script>

<div class="journeys-layout">
	{#if data.error}
		<Alert variant="error" title="Database Error">
			<p>{data.error}</p>
		</Alert>
	{/if}

	<ChartSection
		title="Page Transitions"
		description="Which page follows which, ranked by how often the move happens"
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
					Counted with a window function over consecutive pageviews in the same session. Reloads are
					excluded — they are not navigations. Aggregate paths merge visitors with very different
					intentions, so read this as “what moves are common”, not “why people move”.
				</p>
			{:else}
				<EmptyState
					icon="i-lucide-route"
					title="No transitions yet"
					description="A transition needs two pageviews in one session. Browse a few pages and they will appear here."
				/>
			{/if}
		{/snippet}
	</ChartSection>

	<div class="entry-exit-grid">
		<ChartSection title="Entry Pages" description="Where visitors land first">
			{#snippet chart()}
				{#if data.entryPages.length > 0}
					<div class="page-list">
						{#each data.entryPages as page (page.path)}
							<div class="page-row">
								<code class="page-path">{page.path}</code>
								<div class="transition-bar-track" aria-hidden="true">
									<div class="transition-bar" style="width: {(page.count / maxEntry) * 100}%"></div>
								</div>
								<span class="page-count">{page.count}</span>
							</div>
						{/each}
					</div>
				{:else}
					<EmptyState icon="i-lucide-log-in" title="No sessions yet" />
				{/if}
			{/snippet}
		</ChartSection>

		<ChartSection title="Exit Pages" description="Where visitors leave">
			{#snippet chart()}
				{#if data.exitPages.length > 0}
					<div class="page-list">
						{#each data.exitPages as page (page.path)}
							<div class="page-row">
								<code class="page-path">{page.path}</code>
								<div class="transition-bar-track" aria-hidden="true">
									<div class="transition-bar" style="width: {(page.count / maxExit) * 100}%"></div>
								</div>
								<span class="page-count">{page.count}</span>
							</div>
						{/each}
					</div>
				{:else}
					<EmptyState icon="i-lucide-log-out" title="No sessions yet" />
				{/if}
			{/snippet}
		</ChartSection>
	</div>

	<ChartSection
		title="Recent Sessions"
		description="Last 20 visitor sessions with page counts and duration"
	>
		{#snippet chart()}
			<div class="sessions-table-wrapper">
				<table class="sessions-table" aria-label="Recent sessions">
					<thead>
						<tr>
							<th scope="col">Session</th>
							<th scope="col">Pages</th>
							<th scope="col">Entry</th>
							<th scope="col">Exit</th>
							<th scope="col">Device</th>
							<th scope="col">Country</th>
							<th scope="col">Started</th>
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
