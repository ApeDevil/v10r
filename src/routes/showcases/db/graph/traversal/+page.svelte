<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, NavSection, Alert } from '$lib/components/composites';
	import { Badge, Button, Select, Spinner, Typography } from '$lib/components/primitives';
	import { Table, Header, Body, Row, HeaderCell, Cell } from '$lib/components/primitives';
	import { getToast } from '$lib/state/toast.svelte';
	import { Stack } from '$lib/components/layout';

	let { data } = $props();
	const toast = getToast();

	const sections = [
		{ id: 'browse', label: 'Browse' },
		{ id: 'shortest-path', label: 'Shortest Path' },
		{ id: 'recommendations', label: 'Recommendations' },
		{ id: 'repl', label: 'Cypher REPL' },
		{ id: 'vs-sql', label: 'vs SQL' },
	];

	// ─── Node options for selects ────────────────────────
	const nodeOptions = $derived(
		data.nodes.map((n) => ({ value: n.elementId, label: `${n.name} (${n.label})` }))
	);

	// ─── Browse state ────────────────────────────────────
	let browseNodeId = $state('');
	let browseLoading = $state(false);
	let browseResult = $state<any>(null);

	// ─── Path state ──────────────────────────────────────
	let pathFromId = $state('');
	let pathToId = $state('');
	let pathLoading = $state(false);
	let pathResult = $state<any[] | null>(null);
	let pathMessage = $state('');

	// ─── Recommendation state ────────────────────────────
	let recNodeId = $state('');
	let recLoading = $state(false);
	let recommendations = $state<any[]>([]);

	// ─── REPL state ──────────────────────────────────────
	let replQuery = $state('MATCH (t:Technology) RETURN t.name AS name, t.category AS category LIMIT 5');
	let replLoading = $state(false);
	let replResult = $state<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null);

	function handleResult(key: string) {
		return ({ result, update }: { result: any; update: (opts?: any) => Promise<void> }) => {
			if (result.type === 'success' && result.data) {
				if (key === 'browse') browseResult = result.data.browseResult;
				if (key === 'path') {
					pathResult = result.data.pathResult;
					pathMessage = result.data.pathMessage || '';
				}
				if (key === 'recommend') recommendations = result.data.recommendations ?? [];
				if (key === 'repl') replResult = result.data.replResult;
			} else if (result.type === 'failure') {
				toast.error(result.data?.message || 'Operation failed.');
			}
			return update();
		};
	}

	function formatValue(val: unknown): string {
		if (val === null || val === undefined) return 'NULL';
		if (typeof val === 'object') return JSON.stringify(val);
		return String(val);
	}
</script>

<svelte:head>
	<title>Traversal - Graph - Showcases - Velociraptor</title>
</svelte:head>

{#if data.error}
		<Alert variant="error" title="Database Error">
			<code>{data.error}</code>
			<p>Seed the graph from the <a href="/showcases/db/graph/model">Model</a> page first.</p>
		</Alert>
	{:else}
		<NavSection {sections} ariaLabel="Traversal sections" />

		<Stack gap="6">
			<!-- BROWSE -->
			<section id="browse">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Browse</Typography>
						<Typography variant="muted" as="p">Select a node to see its properties and all connected neighbors.</Typography>
					{/snippet}

					<form
						method="POST"
						action="?/browse"
						use:enhance={() => {
							browseLoading = true;
							return async (event) => {
								browseLoading = false;
								return handleResult('browse')(event);
							};
						}}
					>
						<div class="action-row">
							<Select options={nodeOptions} bind:value={browseNodeId} placeholder="Select a node..." />
							<input type="hidden" name="elementId" value={browseNodeId} />
							<Button type="submit" variant="outline" size="sm" disabled={!browseNodeId || browseLoading}>
								{#if browseLoading}<Spinner size="xs" class="mr-1" />{/if}
								Browse
							</Button>
						</div>
					</form>

					{#if browseResult}
						<div class="browse-result">
							<div class="browse-header">
								{#each browseResult.labels as lbl}
									<Badge>{lbl}</Badge>
								{/each}
								<span class="browse-name">{browseResult.properties.name}</span>
							</div>

							<div class="diag-grid">
								{#each Object.entries(browseResult.properties) as [key, val]}
									<div class="diag-row">
										<span class="diag-label">{key}</span>
										<code class="diag-mono">{formatValue(val)}</code>
									</div>
								{/each}
							</div>

							{#if browseResult.connections.length > 0}
								<h3 class="connections-title">Connections ({browseResult.connections.length})</h3>
								<div class="table-wrap">
									<Table>
										<Header>
											<Row>
												<HeaderCell>Direction</HeaderCell>
												<HeaderCell>Relationship</HeaderCell>
												<HeaderCell>Neighbor</HeaderCell>
												<HeaderCell>Type</HeaderCell>
											</Row>
										</Header>
										<Body>
											{#each browseResult.connections as conn}
												<Row>
													<Cell>
														<Badge variant={conn.direction === 'OUT' ? 'success' : 'warning'}>
															{conn.direction}
														</Badge>
													</Cell>
													<Cell><Badge variant="secondary">{conn.relType}</Badge></Cell>
													<Cell>{conn.neighborName}</Cell>
													<Cell><Badge>{conn.neighborLabel}</Badge></Cell>
												</Row>
											{/each}
										</Body>
									</Table>
								</div>
							{/if}
						</div>
					{/if}
				</Card>
			</section>

			<!-- SHORTEST PATH -->
			<section id="shortest-path">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Shortest Path</Typography>
						<Typography variant="muted" as="p">Find the shortest connection between any two nodes using <code>shortestPath()</code>.</Typography>
					{/snippet}

					<form
						method="POST"
						action="?/shortestPath"
						use:enhance={() => {
							pathLoading = true;
							return async (event) => {
								pathLoading = false;
								return handleResult('path')(event);
							};
						}}
					>
						<div class="action-row">
							<Select options={nodeOptions} bind:value={pathFromId} placeholder="From..." />
							<input type="hidden" name="fromId" value={pathFromId} />
							<span class="arrow-icon">&rarr;</span>
							<Select options={nodeOptions} bind:value={pathToId} placeholder="To..." />
							<input type="hidden" name="toId" value={pathToId} />
							<Button type="submit" variant="outline" size="sm" disabled={!pathFromId || !pathToId || pathLoading}>
								{#if pathLoading}<Spinner size="xs" class="mr-1" />{/if}
								Find Path
							</Button>
						</div>
					</form>

					{#if pathMessage}
						<Typography variant="muted" as="p">{pathMessage}</Typography>
					{/if}

					{#if pathResult && pathResult.length > 0}
						<div class="path-chain">
							{#each pathResult as step, i}
								<div class="path-node">
									<Badge>{step.label}</Badge>
									<span class="path-name">{step.name}</span>
								</div>
								{#if step.relType}
									<div class="path-rel">
										<span class="path-arrow">&rarr;</span>
										<Badge variant="secondary">{step.relType}</Badge>
										<span class="path-arrow">&rarr;</span>
									</div>
								{/if}
							{/each}
						</div>
					{/if}
				</Card>
			</section>

			<!-- RECOMMENDATIONS -->
			<section id="recommendations">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Recommendations</Typography>
						<Typography variant="muted" as="p">Find related items by traversing 2 hops through the graph. Items with more connecting paths score higher.</Typography>
					{/snippet}

					<form
						method="POST"
						action="?/recommend"
						use:enhance={() => {
							recLoading = true;
							return async (event) => {
								recLoading = false;
								return handleResult('recommend')(event);
							};
						}}
					>
						<div class="action-row">
							<Select options={nodeOptions} bind:value={recNodeId} placeholder="Select a node..." />
							<input type="hidden" name="nodeId" value={recNodeId} />
							<Button type="submit" variant="outline" size="sm" disabled={!recNodeId || recLoading}>
								{#if recLoading}<Spinner size="xs" class="mr-1" />{/if}
								Recommend
							</Button>
						</div>
					</form>

					{#if recommendations.length > 0}
						<div class="rec-grid">
							{#each recommendations as rec}
								<div class="rec-card">
									<div class="rec-header">
										<Badge>{rec.label}</Badge>
										<span class="rec-name">{rec.name}</span>
									</div>
									<div class="rec-meta">
										<Badge variant="secondary">score: {rec.score}</Badge>
										<span class="rec-via">via {rec.via}</span>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</Card>
			</section>

			<!-- CYPHER REPL -->
			<section id="repl">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Cypher REPL</Typography>
						<Typography variant="muted" as="p">Run read-only Cypher queries against the graph. Write operations (CREATE, DELETE, etc.) are blocked.</Typography>
					{/snippet}

					<form
						method="POST"
						action="?/repl"
						use:enhance={() => {
							replLoading = true;
							return async (event) => {
								replLoading = false;
								return handleResult('repl')(event);
							};
						}}
					>
						<div class="repl-input">
							<textarea
								name="query"
								bind:value={replQuery}
								rows="3"
								class="repl-textarea"
								placeholder="MATCH (n) RETURN n LIMIT 10"
								spellcheck="false"
							></textarea>
							<Button type="submit" variant="outline" size="sm" disabled={!replQuery.trim() || replLoading}>
								{#if replLoading}<Spinner size="xs" class="mr-1" />{/if}
								<span class="i-lucide-play h-4 w-4 mr-1" />
								Execute
							</Button>
						</div>
					</form>

					{#if replResult}
						{#if replResult.rows.length > 0}
							<div class="table-wrap">
								<Table>
									<Header>
										<Row>
											{#each replResult.columns as col}
												<HeaderCell>{col}</HeaderCell>
											{/each}
										</Row>
									</Header>
									<Body>
										{#each replResult.rows as row}
											<Row>
												{#each replResult.columns as col}
													<Cell><code class="repl-value">{formatValue(row[col])}</code></Cell>
												{/each}
											</Row>
										{/each}
									</Body>
								</Table>
							</div>
							<p class="result-count">{replResult.rows.length} row{replResult.rows.length !== 1 ? 's' : ''} returned</p>
						{:else}
							<Typography variant="muted" as="p">Query returned no results.</Typography>
						{/if}
					{/if}
				</Card>
			</section>

			<!-- VS SQL -->
			<section id="vs-sql">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Graph vs SQL</Typography>
						<Typography variant="muted" as="p">Side-by-side comparison of common queries in Cypher and SQL.</Typography>
					{/snippet}

					<div class="comparison-list">
						<div class="comparison">
							<h3 class="comparison-title">Variable-Depth Traversal</h3>
							<div class="comparison-cols">
								<div class="comparison-col">
									<Badge variant="success">Cypher</Badge>
									<pre class="code-block"><code>MATCH (t:Technology)-[:DEPENDS_ON*1..5]->(dep)
RETURN t.name, dep.name</code></pre>
								</div>
								<div class="comparison-col">
									<Badge variant="warning">SQL</Badge>
									<pre class="code-block"><code>WITH RECURSIVE deps AS (
  SELECT id, name FROM technologies
  WHERE id = ?
  UNION ALL
  SELECT t.id, t.name
  FROM technologies t
  JOIN dependencies d ON t.id = d.dep_id
  JOIN deps ON deps.id = d.tech_id
)
SELECT * FROM deps;</code></pre>
								</div>
							</div>
						</div>

						<div class="comparison">
							<h3 class="comparison-title">Shortest Path</h3>
							<div class="comparison-cols">
								<div class="comparison-col">
									<Badge variant="success">Cypher</Badge>
									<pre class="code-block"><code>MATCH path = shortestPath(
  (a:Technology &#123;name: 'Bun'&#125;)-[*]-(b:Technology &#123;name: 'UnoCSS'&#125;)
)
RETURN [n IN nodes(path) | n.name]</code></pre>
								</div>
								<div class="comparison-col">
									<Badge variant="warning">SQL</Badge>
									<pre class="code-block"><code>-- No native shortest path in SQL.
-- Requires BFS with recursive CTE,
-- visited set tracking, and
-- manual path reconstruction.
-- (~30-50 lines of SQL)</code></pre>
								</div>
							</div>
						</div>

						<div class="comparison">
							<h3 class="comparison-title">Pattern Matching</h3>
							<div class="comparison-cols">
								<div class="comparison-col">
									<Badge variant="success">Cypher</Badge>
									<pre class="code-block"><code>MATCH (a)-[:DEPENDS_ON]->(shared)&lt;-[:DEPENDS_ON]-(b)
WHERE a &lt;&gt; b
RETURN a.name, b.name, shared.name</code></pre>
								</div>
								<div class="comparison-col">
									<Badge variant="warning">SQL</Badge>
									<pre class="code-block"><code>SELECT a.name, b.name, s.name
FROM dependencies d1
JOIN dependencies d2 ON d1.dep_id = d2.dep_id
JOIN technologies a ON d1.tech_id = a.id
JOIN technologies b ON d2.tech_id = b.id
JOIN technologies s ON d1.dep_id = s.id
WHERE a.id &lt;&gt; b.id;</code></pre>
								</div>
							</div>
						</div>
					</div>
				</Card>
			</section>
		</Stack>
	{/if}


<style>
	.action-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.arrow-icon {
		color: var(--color-muted);
		font-size: var(--text-fluid-lg);
	}

	.table-wrap {
		overflow-x: auto;
		margin-top: var(--spacing-4);
	}

	/* ─── Browse ─────────────────────────────────────────── */

	.browse-result {
		margin-top: var(--spacing-5);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.browse-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.browse-name {
		font-weight: 600;
		font-size: var(--text-fluid-lg);
	}

	.connections-title {
		margin: 0;
		font-size: var(--text-fluid-base);
		font-weight: 600;
		padding-top: var(--spacing-3);
		border-top: 1px solid var(--color-border);
	}

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

	.diag-mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}

	/* ─── Shortest Path ──────────────────────────────────── */

	.path-chain {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--spacing-2);
		margin-top: var(--spacing-4);
		padding: var(--spacing-4);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
	}

	.path-node {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
	}

	.path-name {
		font-weight: 500;
		font-size: var(--text-fluid-sm);
	}

	.path-rel {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
	}

	.path-arrow {
		color: var(--color-muted);
	}

	/* ─── Recommendations ────────────────────────────────── */

	.rec-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--spacing-3);
		margin-top: var(--spacing-4);
	}

	.rec-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.rec-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.rec-name {
		font-weight: 500;
		font-size: var(--text-fluid-sm);
	}

	.rec-meta {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.rec-via {
		color: var(--color-muted);
		font-size: var(--text-fluid-xs);
	}

	/* ─── REPL ───────────────────────────────────────────── */

	.repl-input {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		align-items: flex-start;
	}

	.repl-textarea {
		width: 100%;
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
		color: var(--color-fg);
		resize: vertical;
		box-sizing: border-box;
	}

	.repl-textarea:focus {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.repl-value {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}

	.result-count {
		margin: 0;
		margin-top: var(--spacing-2);
		color: var(--color-muted);
		font-size: var(--text-fluid-xs);
		text-align: right;
	}

	/* ─── VS SQL ─────────────────────────────────────────── */

	.comparison-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.comparison-title {
		margin: 0 0 var(--spacing-3) 0;
		font-size: var(--text-fluid-base);
		font-weight: 600;
	}

	.comparison-cols {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-3);
	}

	.comparison-col {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.code-block {
		margin: 0;
		padding: var(--spacing-3);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		overflow-x: auto;
		font-size: var(--text-fluid-xs);
		line-height: 1.6;
	}

	@media (max-width: 640px) {
		.comparison-cols {
			grid-template-columns: 1fr;
		}
	}
</style>
