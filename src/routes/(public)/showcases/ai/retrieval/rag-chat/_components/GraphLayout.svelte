<script lang="ts">
import { onMount, type Snippet } from 'svelte';
import { apiFetch } from '$lib/api';
import { KnowledgeGraph } from '$lib/components/viz/graph';
import type { KnowledgeData } from '$lib/types/knowledge';

interface Props {
	children: Snippet;
	onNodeSelect: (label: string) => void;
}

let { children, onNodeSelect }: Props = $props();

let graphData = $state<KnowledgeData | null>(null);
let loading = $state(false);
let error = $state<string | null>(null);

async function loadGraph() {
	loading = true;
	error = null;
	try {
		const res = await apiFetch('/api/retrieval/graph');
		if (!res.ok) {
			error = `HTTP ${res.status}`;
			return;
		}
		const json = await res.json();
		graphData = json.data as KnowledgeData;
	} catch (err) {
		error = err instanceof Error ? err.message : 'Failed to load graph';
	} finally {
		loading = false;
	}
}

function handleNodeClick(nodeId: string) {
	if (!graphData) return;
	const node = graphData.nodes.find((n) => n.id === nodeId);
	if (!node) return;
	onNodeSelect(node.label ?? nodeId);
}

onMount(loadGraph);
</script>

<div class="graph-layout">
	<div class="canvas">
		{#if loading}
			<div class="canvas-empty">Loading entity graph…</div>
		{:else if error}
			<div class="canvas-empty canvas-error">{error}</div>
		{:else if graphData && graphData.nodes.length > 0}
			<KnowledgeGraph
				data={graphData}
				aspect="wide"
				ariaLabel="Entity graph"
				onNodeClick={handleNodeClick}
			/>
			<p class="canvas-hint">
				<span class="i-lucide-mouse-pointer-click h-3 w-3" aria-hidden="true"></span>
				Click an entity to ask about it.
			</p>
		{:else}
			<div class="canvas-empty">
				<p>No entities in the corpus yet.</p>
				<p class="subtle">Ingest a document with entity extraction enabled to populate the graph.</p>
			</div>
		{/if}
	</div>

	<div class="chat-pane">
		{@render children()}
	</div>
</div>

<style>
	.graph-layout {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: var(--spacing-4);
		min-height: 0;
	}

	@media (max-width: 960px) {
		.graph-layout {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
		}
	}

	.canvas {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		min-width: 0;
		min-height: 360px;
		padding: var(--spacing-3);
		border-right: 1px solid var(--color-border);
	}

	@media (max-width: 960px) {
		.canvas {
			border-right: none;
			border-bottom: 1px solid var(--color-border);
		}
	}

	.canvas-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-2);
		height: 360px;
		color: var(--color-muted);
		font-size: 13px;
		text-align: center;
	}

	.canvas-empty .subtle {
		font-size: 11px;
		opacity: 0.8;
	}

	.canvas-error {
		color: var(--color-error-fg);
	}

	.canvas-hint {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		margin: 0;
		font-size: 11px;
		color: var(--color-muted);
	}

	.chat-pane {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
</style>
