<script lang="ts">
import type { ActionResult } from '@sveltejs/kit';
import { enhance } from '$app/forms';
import { Alert, Card, ConfirmDialog, NavSection } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Body, Button, Cell, Header, HeaderCell, Row, Table, Typography } from '$lib/components/primitives';
import KnowledgeGraph from '$lib/components/viz/graph/knowledge/KnowledgeGraph.svelte';
import { getToast } from '$lib/state/toast.svelte';

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
	return ({
		result,
		update,
	}: {
		result: ActionResult;
		update: (opts?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
	}) => {
		if (result.type === 'success') {
			toast.success((result.data?.message as string) || 'Done.');
		} else if (result.type === 'failure') {
			toast.error((result.data?.message as string) || 'Operation failed.');
		}
		return update();
	};
}
</script>

<svelte:head>
	<title>Model - Graph - Showcases - Velociraptor</title>
</svelte:head>

{#if data.error}
		<Alert variant="error" title="Database Error">
			<code>{data.error}</code>
			<p>Use the Reset Data button to seed the graph, or check your Neo4j connection.</p>
		</Alert>
	{:else}
		<NavSection {sections} ariaLabel="Model sections" />

		<Stack gap="6">
			<!-- NODE LABELS -->
			<section id="labels">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Node Labels</Typography>
						<Typography variant="muted" as="p">Each label represents a category of nodes in the graph. Like tables in a relational database, but schema-flexible.</Typography>
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
						<Typography variant="muted" as="p">No labels found. Use Reset Data to seed the graph.</Typography>
					{/if}
				</Card>
			</section>

			<!-- RELATIONSHIPS -->
			<section id="relationships">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Relationship Types</Typography>
						<Typography variant="muted" as="p">Relationships connect nodes with typed, directed edges. Each type represents a distinct semantic connection.</Typography>
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
						<Typography variant="muted" as="p">No relationship types found. Use Reset Data to seed the graph.</Typography>
					{/if}
				</Card>
			</section>

			<!-- GRAPH SCHEMA -->
			<section id="graph">
				<Card>
					{#snippet header()}
						<Cluster justify="between" align="start">
							<div>
								<Typography variant="h5" as="h2">Graph Schema</Typography>
								<Typography variant="muted" as="p">Interactive visualization of all nodes and relationships. Filter by entity type or search by name.</Typography>
							</div>
							<Button
								variant="outline"
								size="sm"
								onclick={() => (resetDialogOpen = true)}
							>
								<span class="i-lucide-refresh-cw h-4 w-4 mr-1" ></span>
								Reset Data
							</Button>
						</Cluster>
					{/snippet}

					{#if data.graphData.nodes.length > 0}
						<KnowledgeGraph
							data={data.graphData}
							ariaLabel="Tech stack knowledge graph"
						/>
					{:else}
						<Typography variant="muted" as="p">No graph data. Click Reset Data to seed the knowledge graph.</Typography>
					{/if}
				</Card>
			</section>

			<!-- PROPERTIES -->
			<section id="properties">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Properties</Typography>
						<Typography variant="muted" as="p">Property keys collected from each entity type. Unlike relational columns, graph properties are schema-flexible per node.</Typography>
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
						<Typography variant="muted" as="p">No properties found.</Typography>
					{/if}
				</Card>
			</section>
		</Stack>
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


<style>
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
</style>
