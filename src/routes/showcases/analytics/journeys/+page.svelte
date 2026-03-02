<script lang="ts">
	import { Alert, Card } from '$lib/components/composites';
	import { SankeyDiagram } from '$lib/components/viz/graph/sankey';
	import ChartSection from '../_components/ChartSection.svelte';
	import type { SankeyData } from '$lib/components/viz/graph/sankey/types';

	let { data } = $props();

	function buildSankeyData(
		paths: { source: string; target: string; count: number }[],
	): SankeyData {
		const nodeSet = new Set<string>();
		for (const p of paths) {
			nodeSet.add(p.source);
			nodeSet.add(p.target);
		}
		return {
			nodes: [...nodeSet].map((id) => ({ id, label: id === '/' ? 'Home' : id })),
			edges: paths.map((p) => ({
				source: p.source,
				target: p.target,
				value: p.count,
			})),
		};
	}

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
			<p class="mt-2 text-sm text-muted">Try reseeding the analytics data to create the required tables and data.</p>
		</Alert>
	{/if}

	<!-- Sankey diagram (streamed from Neo4j) -->
	<ChartSection
		title="User Flows"
		description="Page-to-page transitions showing how visitors navigate through the site"
		details="Graph data comes from Neo4j. Each link represents the number of sessions that went from one page to another. Thicker links = more traffic."
	>
		{#snippet chart()}
			{#await data.graph}
				<div class="skeleton-sankey" aria-label="Loading user flow diagram">
					<div class="skeleton-bar" style="width: 80%"></div>
					<div class="skeleton-bar" style="width: 60%"></div>
					<div class="skeleton-bar" style="width: 45%"></div>
					<div class="skeleton-bar" style="width: 30%"></div>
					<div class="skeleton-bar" style="width: 20%"></div>
				</div>
			{:then graphData}
				{#if graphData && graphData[0].length > 0}
					{@const sankeyData = buildSankeyData(graphData[0])}
					<SankeyDiagram data={sankeyData} ariaLabel="User navigation flow between pages" />
				{:else}
					<Alert variant="info" title="No graph data">
						<p>Neo4j graph data is not available. Seed the analytics data and run the graph sync to populate journey data.</p>
					</Alert>
				{/if}
			{:catch}
				<Alert variant="error" title="Graph Query Failed">
					<p>Could not load journey data from Neo4j. The graph database may be unavailable.</p>
				</Alert>
			{/await}
		{/snippet}
	</ChartSection>

	<!-- Entry/Exit pages (streamed) -->
	{#await data.graph then graphData}
		{#if graphData}
			<div class="entry-exit-grid">
				{#if graphData[1].length > 0}
					<ChartSection title="Entry Pages" description="Where visitors land first">
						{#snippet chart()}
							<div class="page-list">
								{#each graphData[1] as page}
									<div class="page-row">
										<code class="page-path">{page.path}</code>
										<span class="page-count">{page.count}</span>
									</div>
								{/each}
							</div>
						{/snippet}
					</ChartSection>
				{/if}

				{#if graphData[2].length > 0}
					<ChartSection title="Exit Pages" description="Where visitors leave">
						{#snippet chart()}
							<div class="page-list">
								{#each graphData[2] as page}
									<div class="page-row">
										<code class="page-path">{page.path}</code>
										<span class="page-count">{page.count}</span>
									</div>
								{/each}
							</div>
						{/snippet}
					</ChartSection>
				{/if}
			</div>
		{/if}
	{/await}

	<!-- Recent sessions table -->
	<ChartSection
		title="Recent Sessions"
		description="Last 20 visitor sessions with page counts and duration"
	>
		{#snippet chart()}
			<div class="sessions-table-wrapper">
				<table class="sessions-table">
					<thead>
						<tr>
							<th>Session</th>
							<th>Pages</th>
							<th>Entry</th>
							<th>Exit</th>
							<th>Device</th>
							<th>Country</th>
							<th>Started</th>
						</tr>
					</thead>
					<tbody>
						{#each data.sessions as session}
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
</div>

<style>
	.journeys-layout {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.skeleton-sankey {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		padding: var(--spacing-6);
		min-height: 200px;
	}

	.skeleton-bar {
		height: 24px;
		border-radius: var(--radius-md);
		background: var(--color-subtle);
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
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

	.page-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.page-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.page-path {
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
	}

	.page-count {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
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
