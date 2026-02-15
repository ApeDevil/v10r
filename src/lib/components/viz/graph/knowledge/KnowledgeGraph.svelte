<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import NetworkGraph from '../network/NetworkGraph.svelte';
	import KnowledgeFilters from './KnowledgeFilters.svelte';
	import type { ChartContainerVariants } from '../../_shared/chart-container';
	import type { KnowledgeData } from './knowledge-types';
	import type { NetworkData, NetworkNode } from '../network/types';

	interface Props {
		data: KnowledgeData;
		aspect?: ChartContainerVariants['aspect'];
		ariaLabel?: string;
		class?: string;
	}

	let {
		data,
		aspect = 'chart',
		ariaLabel = 'Knowledge graph',
		class: className,
	}: Props = $props();

	let searchQuery = $state('');
	let activeEntityTypes = $state(new Set(data.entityTypes));
	let activeRelationshipTypes = $state(new Set(data.relationshipTypes));

	// Compute filtered data for NetworkGraph
	let filteredData = $derived.by((): NetworkData => {
		const searchLower = searchQuery.toLowerCase();

		// Filter nodes by entity type + search
		const filteredNodes = data.nodes.filter((node) => {
			if (!activeEntityTypes.has(node.entityType)) return false;
			if (searchLower && !(node.label ?? node.id).toLowerCase().includes(searchLower)) {
				return false;
			}
			return true;
		});

		const nodeIds = new Set(filteredNodes.map((n) => n.id));

		// Filter edges by relationship type + both endpoints must be visible
		const filteredEdges = data.edges.filter((edge) => {
			if (!activeRelationshipTypes.has(edge.relationshipType)) return false;
			return nodeIds.has(edge.source) && nodeIds.has(edge.target);
		});

		// Map to NetworkData format — use entityType as group for coloring
		const networkNodes: NetworkNode[] = filteredNodes.map((n) => ({
			id: n.id,
			label: n.label,
			group: n.entityType,
			size: 7,
		}));

		return {
			nodes: networkNodes,
			edges: filteredEdges.map((e) => ({
				source: e.source,
				target: e.target,
			})),
		};
	});

	function handleFilterChange(filters: {
		searchQuery: string;
		activeEntityTypes: Set<string>;
		activeRelationshipTypes: Set<string>;
	}) {
		searchQuery = filters.searchQuery;
		activeEntityTypes = filters.activeEntityTypes;
		activeRelationshipTypes = filters.activeRelationshipTypes;
	}
</script>

<div class={cn('knowledge-graph-wrapper', className)}>
	<KnowledgeFilters
		{data}
		{searchQuery}
		{activeEntityTypes}
		{activeRelationshipTypes}
		onFilterChange={handleFilterChange}
	/>

	<div class="graph-area">
		{#if filteredData.nodes.length === 0}
			<div class="empty-state">
				<p class="empty-message">
					{searchQuery
						? `No entities found for "${searchQuery}"`
						: 'No results match your filters'}
				</p>
				<button
					type="button"
					class="empty-action"
					onclick={() => {
						handleFilterChange({
							searchQuery: '',
							activeEntityTypes: new Set(data.entityTypes),
							activeRelationshipTypes: new Set(data.relationshipTypes),
						});
					}}
				>
					Clear filters
				</button>
			</div>
		{:else}
			<NetworkGraph
				data={filteredData}
				{aspect}
				{ariaLabel}
			/>
		{/if}
	</div>
</div>

<style>
	.knowledge-graph-wrapper {
		display: grid;
		grid-template-columns: 220px 1fr;
		gap: var(--spacing-4);
		min-height: 400px;
	}

	@media (max-width: 768px) {
		.knowledge-graph-wrapper {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
		}
	}

	.graph-area {
		min-height: 0;
		position: relative;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		min-height: 300px;
		gap: var(--spacing-4);
		color: var(--color-muted);
	}

	.empty-message {
		font-size: var(--text-fluid-base);
		text-align: center;
	}

	.empty-action {
		font-size: 13px;
		color: var(--color-primary);
		cursor: pointer;
		padding: var(--spacing-2) var(--spacing-4);
		border: 1px solid var(--color-primary);
		border-radius: var(--radius-sm);
	}

	.empty-action:hover {
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}

	.empty-action:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
