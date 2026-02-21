<script lang="ts">
	import { enhance } from '$app/forms';
	import { PageHeader, BackLink, Card, SectionNav, ConfirmDialog } from '$lib/components/composites';
	import { Badge, Button } from '$lib/components/primitives';
	import { Table, Header, Body, Row, HeaderCell, Cell } from '$lib/components/primitives';
	import { getToast } from '$lib/stores/toast.svelte';
	import KnowledgeGraph from '$lib/components/viz/graph/knowledge/KnowledgeGraph.svelte';

	let { data } = $props();
	const toast = getToast();

	let resetDialogOpen = $state(false);

	const sections = [
		{ id: 'labels', label: 'Node Labels' },
		{ id: 'relationships', label: 'Relationships' },
		{ id: 'graph', label: 'Graph Schema' },
		{ id: 'properties', label: 'Properties' },
	];

	// Derive property info client-side by grouping nodes
	const propertyGroups = $derived.by(() => {
		const groups = new Map<string, Set<string>>();
		for (const node of data.graphData.nodes) {
			const type = node.entityType;
			if (!groups.has(type)) groups.set(type, new Set());
			const set = groups.get(type)!;
			if (node.properties) {
				for (const key of Object.keys(node.properties)) {
					set.add(key);
				}
			}
		}
		return [...groups.entries()].map(([type, keys]) => ({
			type,
			properties: [...keys].sort(),
		}));
	});

	const totalNodes = $derived(data.labels.reduce((sum, l) => sum + l.count, 0));
	const totalRels = $derived(data.relTypes.reduce((sum, r) => sum + r.count, 0));

	function handleActionResult() {
		return ({ result, update }: { result: any; update: (opts?: any) => Promise<void> }) => {
			if (result.type === 'success') {
				toast.success(result.data?.message || 'Done.');
			} else if (result.type === 'failure') {
				toast.error(result.data?.message || 'Operation failed.');
			}
			return update();
		};
	}
</script>

<svelte:head>
	<title>Model - Graph - Showcases - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Model"
		description="Graph schema introspection — {totalNodes} nodes, {totalRels} relationships across {data.labels.length} labels. Loaded in {data.queryMs}ms."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'DB', href: '/showcases/db' },
			{ label: 'Graph', href: '/showcases/db/neo4j' },
			{ label: 'Model' }
		]}
	/>

	{#if data.error}
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Database Error</h2>
			{/snippet}
			<div class="error-info">
				<code class="error-msg">{data.error}</code>
				<p>Use the Reset Data button to seed the graph, or check your Neo4j connection.</p>
			</div>
		</Card>
	{:else}
		<SectionNav {sections} ariaLabel="Model sections" />

		<div class="sections">
			<!-- NODE LABELS -->
			<section id="labels">
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-lg font-semibold">Node Labels</h2>
						<p class="section-desc">Each label represents a category of nodes in the graph. Like tables in a relational database, but schema-flexible.</p>
					{/snippet}

					{#if data.labels.length > 0}
						<div class="table-wrap">
							<Table>
								<Header>
									<Row>
										<HeaderCell>Label</HeaderCell>
										<HeaderCell>Count</HeaderCell>
										<HeaderCell>Sample Properties</HeaderCell>
									</Row>
								</Header>
								<Body>
									{#each data.labels as label}
										<Row>
											<Cell><Badge>{label.label}</Badge></Cell>
											<Cell><code>{label.count}</code></Cell>
											<Cell>
												<span class="props-list">
													{#each label.sampleProperties as prop}
														<code class="prop-chip">{prop}</code>
													{/each}
												</span>
											</Cell>
										</Row>
									{/each}
								</Body>
							</Table>
						</div>
					{:else}
						<p class="empty">No labels found. Use Reset Data to seed the graph.</p>
					{/if}
				</Card>
			</section>

			<!-- RELATIONSHIPS -->
			<section id="relationships">
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-lg font-semibold">Relationship Types</h2>
						<p class="section-desc">Relationships connect nodes with typed, directed edges. Each type represents a distinct semantic connection.</p>
					{/snippet}

					{#if data.relTypes.length > 0}
						<div class="table-wrap">
							<Table>
								<Header>
									<Row>
										<HeaderCell>Type</HeaderCell>
										<HeaderCell>Count</HeaderCell>
										<HeaderCell>Pattern</HeaderCell>
									</Row>
								</Header>
								<Body>
									{#each data.relTypes as rel}
										<Row>
											<Cell><Badge variant="secondary">{rel.type}</Badge></Cell>
											<Cell><code>{rel.count}</code></Cell>
											<Cell>
												<span class="pattern">
													<Badge>{rel.startLabel}</Badge>
													<span class="arrow">&rarr;</span>
													<Badge>{rel.endLabel}</Badge>
												</span>
											</Cell>
										</Row>
									{/each}
								</Body>
							</Table>
						</div>
					{:else}
						<p class="empty">No relationship types found. Use Reset Data to seed the graph.</p>
					{/if}
				</Card>
			</section>

			<!-- GRAPH SCHEMA -->
			<section id="graph">
				<Card>
					{#snippet header()}
						<div class="card-header-row">
							<div>
								<h2 class="text-fluid-lg font-semibold">Graph Schema</h2>
								<p class="section-desc">Interactive visualization of all nodes and relationships. Filter by entity type or search by name.</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								onclick={() => (resetDialogOpen = true)}
							>
								<span class="i-lucide-refresh-cw h-4 w-4 mr-1" />
								Reset Data
							</Button>
						</div>
					{/snippet}

					{#if data.graphData.nodes.length > 0}
						<KnowledgeGraph
							data={data.graphData}
							ariaLabel="Tech stack knowledge graph"
						/>
					{:else}
						<p class="empty">No graph data. Click Reset Data to seed the knowledge graph.</p>
					{/if}
				</Card>
			</section>

			<!-- PROPERTIES -->
			<section id="properties">
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-lg font-semibold">Properties</h2>
						<p class="section-desc">Property keys collected from each entity type. Unlike relational columns, graph properties are schema-flexible per node.</p>
					{/snippet}

					{#if propertyGroups.length > 0}
						<div class="property-groups">
							{#each propertyGroups as group}
								<div class="property-group">
									<h3 class="property-group-title">
										<Badge>{group.type}</Badge>
									</h3>
									<div class="props-list">
										{#each group.properties as prop}
											<code class="prop-chip">{prop}</code>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<p class="empty">No properties found.</p>
					{/if}
				</Card>
			</section>
		</div>
	{/if}

	<ConfirmDialog
		bind:open={resetDialogOpen}
		title="Reset Graph Data"
		description="This will delete all nodes and relationships, then re-seed the Tech Stack Knowledge Graph. This cannot be undone."
		confirmLabel="Reset"
		destructive
		onconfirm={() => {
			resetDialogOpen = false;
			const form = document.getElementById('reseed-form') as HTMLFormElement;
			form?.requestSubmit();
		}}
		oncancel={() => (resetDialogOpen = false)}
	/>

	<form
		id="reseed-form"
		method="POST"
		action="?/reseed"
		class="hidden"
		use:enhance={() => handleActionResult()}
	>
	</form>

	<BackLink href="/showcases/db/neo4j" label="Graph" />
</div>

<style>
	.page {
		width: 100%;
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		box-sizing: border-box;
	}

	.sections {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.card-header-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--spacing-4);
	}

	.section-desc {
		margin: 0;
		margin-top: var(--spacing-1);
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.table-wrap {
		overflow-x: auto;
	}

	.pattern {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.arrow {
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.props-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-1);
	}

	.prop-chip {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		padding: 1px var(--spacing-2);
		background: var(--color-subtle);
		border-radius: var(--radius-sm);
		color: var(--color-muted);
	}

	.property-groups {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	.property-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.property-group-title {
		margin: 0;
		font-size: var(--text-fluid-base);
	}

	.empty {
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		text-align: center;
		padding: var(--spacing-6) 0;
	}

	.hidden {
		display: none;
	}

	.error-info {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.error-msg {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
		color: var(--color-error);
		word-break: break-all;
	}

	.error-info p {
		margin: 0;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	@media (min-width: 768px) {
		.page {
			padding: var(--spacing-7);
		}
	}

	@media (max-width: 640px) {
		.page {
			padding: var(--spacing-4);
		}
	}
</style>
