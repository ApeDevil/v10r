<!--
  Paths (provenance) pane. rawrag: chunk cards + the DAG + the entity graph, filtered by the
  selected step. llmwiki: the distinct page/drill/citation cards (no similarity score).
  Reuses the existing trace view components; cross-panel selection flows via the factory.
-->
<script lang="ts">
import { apiFetch } from '$lib/api';
import { ToggleGroup } from '$lib/components/primitives';
import { ChartEmpty, ChartError, KnowledgeGraph } from '$lib/components/viz';
import type { KnowledgeData } from '$lib/types/knowledge';
import type { ChunkSummary } from '$lib/types/pipeline';
import WikiDetailPanel from '../llmwiki/WikiDetailPanel.svelte';
import WikiFlowGraph from '../llmwiki/WikiFlowGraph.svelte';
import ChunkList from '../rawrag/ChunkList.svelte';
import PipelineGraph from '../rawrag/PipelineGraph.svelte';
import type { NragTraceState } from '../trace/nrag-trace.svelte';

interface Props {
	trace: NragTraceState;
}

let { trace }: Props = $props();

type RawragView = 'chunks' | 'pipeline' | 'entities';
let rawragView = $state<RawragView>('chunks');
const viewItems = [
	{ value: 'chunks', label: 'Chunks' },
	{ value: 'pipeline', label: 'Pipeline' },
	{ value: 'entities', label: 'Entities' },
];

const visibleChunks = $derived<ChunkSummary[]>(
	trace.selectedStepId ? trace.chunksForStep(trace.selectedStepId) : (trace.chunkData?.contextChunks ?? []),
);

const selectionLabel = $derived(trace.selectedStep?.label ?? 'final context');

const funnelStats = $derived.by(() => {
	const data = trace.chunkData;
	if (!data || trace.selectedStepId) return undefined;
	const found = Object.values(data.tierChunks).reduce((sum, c) => sum + (c?.length ?? 0), 0);
	return { found, kept: data.rankedChunks.length, context: data.contextChunks.length };
});

// Entity graph — lazy-loaded only when the Entities view is opened.
let graphData = $state<KnowledgeData | null>(null);
let graphLoading = $state(false);
let graphError = $state<string | null>(null);

async function loadGraph() {
	if (graphData || graphLoading) return;
	graphLoading = true;
	graphError = null;
	try {
		const res = await apiFetch('/api/retrieval/graph');
		if (!res.ok) {
			graphError = `HTTP ${res.status}`;
			return;
		}
		const json = await res.json();
		graphData = json.data as KnowledgeData;
	} catch (err) {
		graphError = err instanceof Error ? err.message : 'Failed to load graph';
	} finally {
		graphLoading = false;
	}
}

$effect(() => {
	if (trace.path === 'rawrag' && rawragView === 'entities') {
		void loadGraph();
	}
});
</script>

<div class="paths-pane">
	{#if trace.path === 'llmwiki'}
		<div class="wiki-grid">
			<div class="wiki-flow">
				<WikiFlowGraph {trace} onselect={(id) => trace.selectStep(id)} />
			</div>
			<div class="wiki-detail">
				<WikiDetailPanel {trace} />
			</div>
		</div>
	{:else}
		<div class="rawrag-toolbar">
			<ToggleGroup type="single" size="sm" items={viewItems} bind:value={rawragView} />
		</div>

		{#if rawragView === 'chunks'}
			<p class="filter-note">
				Showing chunks for <strong>{selectionLabel}</strong>
				{#if trace.selectedStepId}
					<button type="button" class="clear" onclick={() => trace.selectStep(trace.selectedStepId)}>
						clear
					</button>
				{/if}
			</p>
			{#if visibleChunks.length === 0 && !trace.chunkData}
				<p class="empty">Ask a question — retrieved chunks appear here.</p>
			{:else}
				<ChunkList chunks={visibleChunks} {funnelStats} maxHeight="360px" />
			{/if}
		{:else if rawragView === 'pipeline'}
			<PipelineGraph
				steps={trace.steps}
				chunkCounts={trace.chunkCounts}
				onselect={(id) => trace.selectStep(id)}
			/>
		{:else if graphLoading}
			<ChartEmpty message="Loading entity graph…" />
		{:else if graphError}
			<ChartError error={graphError} />
		{:else if graphData && graphData.nodes.length > 0}
			<KnowledgeGraph data={graphData} aspect="wide" ariaLabel="Entity graph" />
		{:else}
			<ChartEmpty message="No entities in the corpus yet." />
		{/if}
	{/if}
</div>

<style>
	.paths-pane {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.wiki-grid {
		display: grid;
		grid-template-columns: 180px 1fr;
		gap: var(--spacing-4);
	}

	@container (max-width: 560px) {
		.wiki-grid {
			grid-template-columns: 1fr;
		}
	}

	.rawrag-toolbar {
		display: flex;
		justify-content: flex-start;
	}

	.filter-note {
		margin: 0;
		font-size: 11px;
		color: var(--color-muted);
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.filter-note strong {
		color: var(--color-fg);
	}

	.clear {
		border: none;
		background: transparent;
		color: var(--color-primary);
		cursor: pointer;
		font-size: 11px;
		padding: 0;
		text-decoration: underline;
	}

	.empty {
		margin: 0;
		font-size: 12px;
		color: var(--color-muted);
	}
</style>
