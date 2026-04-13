<script lang="ts">
import { goto } from '$app/navigation';
import { apiFetch } from '$lib/api';
import { Alert, Card, NavSection } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge, Button, Spinner, Typography } from '$lib/components/primitives';
import { KnowledgeGraph } from '$lib/components/viz/graph';
import { GraphExplorerState } from '$lib/components/viz/graph/knowledge/graph-explorer-state.svelte';
import NodeDetailPanel from '$lib/components/viz/graph/knowledge/NodeDetailPanel.svelte';
import type { KnowledgeData, KnowledgeEdge, KnowledgeNode } from '$lib/types/knowledge';

let { data } = $props();

const explorer = new GraphExplorerState();

let query = $state('');
let searchLoading = $state(false);
let graphLoading = $state(false);
let expandLoading = $state(false);
let pathLoading = $state(false);
let error = $state<string | null>(null);
let searchMeta = $state<{ seeds: number; graphDiscovered: number; durationMs: number } | null>(null);

// Path-finding state
let pathFromId = $state<string | null>(null);
let pathToId = $state<string | null>(null);
let pathHighlight = $state<{ nodeIds: Set<string>; edgeKeys: Set<string> } | null>(null);

const sections = [
	{ id: 'search', label: 'Search' },
	{ id: 'explorer', label: 'Explorer' },
	{ id: 'results', label: 'Results' },
];

// Search results for the text display
let searchResults = $state<
	Array<{
		chunkId: string;
		documentTitle: string;
		content: string;
		score: number;
		source: string;
		tier: number;
	}>
>([]);

interface RetrievedEntity {
	elementId: string;
	name: string;
	type: string;
	related: Array<{ elementId: string; name: string }>;
}

function entitiesToKnowledgeData(entities: RetrievedEntity[]): KnowledgeData {
	const nodeMap = new Map<string, KnowledgeNode>();
	const edges: KnowledgeEdge[] = [];

	for (const entity of entities) {
		nodeMap.set(entity.elementId, {
			id: entity.elementId,
			label: entity.name,
			entityType: entity.type,
		});
		// Ensure related entities exist as nodes too
		for (const related of entity.related) {
			if (!nodeMap.has(related.elementId)) {
				nodeMap.set(related.elementId, {
					id: related.elementId,
					label: related.name,
					entityType: 'unknown',
				});
			}
			edges.push({
				source: entity.elementId,
				target: related.elementId,
				relationshipType: 'RELATED_TO',
				label: 'RELATED_TO',
			});
		}
	}

	// Dedupe edges
	const seen = new Set<string>();
	const uniqueEdges = edges.filter((e) => {
		const key = `${e.source}→${e.target}→${e.relationshipType}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	const nodes = [...nodeMap.values()];
	const entityTypes = [...new Set(nodes.map((n) => n.entityType))].sort();
	const relationshipTypes = [...new Set(uniqueEdges.map((e) => e.relationshipType))].sort();

	return { nodes, edges: uniqueEdges, entityTypes, relationshipTypes };
}

async function search() {
	if (!query.trim() || searchLoading) return;

	searchLoading = true;
	error = null;
	searchMeta = null;

	try {
		const res = await apiFetch('/api/retrieval/search', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ query: query.trim(), tiers: [3], maxChunks: 8, graphDepth: 2 }),
		});

		if (!res.ok) {
			const errJson = await res.json().catch(() => ({}));
			throw new Error(errJson.error?.message ?? `HTTP ${res.status}`);
		}

		const { data: resData } = await res.json();
		searchResults = resData.chunks ?? [];
		const entities: RetrievedEntity[] = resData.entities ?? [];

		const seeds = searchResults.filter((r) => r.source === 'vector').length;
		const graphDiscovered = searchResults.filter((r) => r.source === 'graph').length;
		searchMeta = { seeds, graphDiscovered, durationMs: resData.durationMs };

		if (entities.length > 0) {
			const graphData = entitiesToKnowledgeData(entities);
			explorer.replace(graphData);
		} else {
			explorer.clear();
		}
	} catch (err) {
		error = err instanceof Error ? err.message : 'Search failed';
		searchResults = [];
		explorer.clear();
	} finally {
		searchLoading = false;
	}
}

async function loadAllEntities() {
	graphLoading = true;
	error = null;

	try {
		const res = await apiFetch('/api/retrieval/graph');
		if (!res.ok) {
			const errJson = await res.json().catch(() => ({}));
			throw new Error(errJson.error?.message ?? `HTTP ${res.status}`);
		}

		const { data: graphData } = await res.json();
		explorer.replace(graphData);
		searchResults = [];
		searchMeta = null;
	} catch (err) {
		error = err instanceof Error ? err.message : 'Failed to load graph';
	} finally {
		graphLoading = false;
	}
}

async function expandNode(nodeId: string) {
	if (explorer.isExpanded(nodeId)) return;

	expandLoading = true;
	try {
		const res = await apiFetch(`/api/retrieval/graph/node/${encodeURIComponent(nodeId)}`);
		if (!res.ok) {
			const errJson = await res.json().catch(() => ({}));
			throw new Error(errJson.error?.message ?? `HTTP ${res.status}`);
		}

		const { data: neighborData } = await res.json();
		explorer.merge(neighborData);
		explorer.markExpanded(nodeId);
	} catch (err) {
		error = err instanceof Error ? err.message : 'Failed to expand node';
	} finally {
		expandLoading = false;
	}
}

function handleNodeClick(nodeId: string) {
	explorer.selectedNodeId = nodeId;
}

function handleCloseDetail() {
	explorer.selectedNodeId = null;
}

function handleSetPathFrom(nodeId: string) {
	pathFromId = pathFromId === nodeId ? null : nodeId;
	pathHighlight = null;
}

function handleSetPathTo(nodeId: string) {
	pathToId = pathToId === nodeId ? null : nodeId;
	pathHighlight = null;
}

async function findPath() {
	if (!pathFromId || !pathToId || pathFromId === pathToId || pathLoading) return;
	pathLoading = true;
	error = null;
	try {
		const params = new URLSearchParams({ from: pathFromId, to: pathToId, maxHops: '4' });
		const res = await apiFetch(`/api/retrieval/graph/path?${params}`);
		if (!res.ok) {
			const errJson = await res.json().catch(() => ({}));
			throw new Error(errJson.error?.message ?? `HTTP ${res.status}`);
		}
		const { data: pathData } = await res.json();
		explorer.merge(pathData.data);
		pathHighlight = {
			nodeIds: new Set(pathData.nodeIds),
			edgeKeys: new Set(pathData.edgeKeys),
		};
	} catch (err) {
		error = err instanceof Error ? err.message : 'Failed to find path';
		pathHighlight = null;
	} finally {
		pathLoading = false;
	}
}

function clearPath() {
	pathFromId = null;
	pathToId = null;
	pathHighlight = null;
}

function askAboutNode(node: KnowledgeNode) {
	const label = node.label ?? node.id;
	const params = new URLSearchParams({ mode: 'graph', seed: label });
	goto(`/showcases/ai/retrieval/rag-chat?${params}`);
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault();
		search();
	}
}
</script>

<svelte:head>
	<title>Graph Explorer - Retrieval - AI - Showcases - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	{#if !data.configured}
		<Alert variant="info" title="AI Not Configured">
			<p>Configure AI + Neo4j and ingest documents with entity extraction to use the graph explorer.</p>
		</Alert>
	{:else}
		<NavSection {sections} ariaLabel="Explorer sections" />

		<!-- SEARCH -->
		<section id="search">
			<Card>
				{#snippet header()}
					<Typography variant="h5" as="h2">Graph Explorer</Typography>
					<Typography variant="muted" as="p">Search via RAG to discover entities, or load the full entity graph. Click nodes to inspect, expand to discover neighbors.</Typography>
				{/snippet}

				<Stack gap="4">
					<div class="search-form">
						<input
							type="text"
							bind:value={query}
							onkeydown={handleKeydown}
							placeholder="Enter a search query..."
							class="search-input"
							disabled={searchLoading || graphLoading}
							aria-label="Search query"
						/>
						<Button variant="primary" onclick={search} disabled={searchLoading || graphLoading || !query.trim()}>
							{#if searchLoading}
								<Spinner size="xs" class="mr-1" />
							{/if}
							<span class="i-lucide-search h-4 w-4 mr-1"></span>
							Search
						</Button>
					</div>

					<div class="action-row">
						<Button variant="outline" size="sm" onclick={loadAllEntities} disabled={searchLoading || graphLoading}>
							{#if graphLoading}
								<Spinner size="xs" class="mr-1" />
							{/if}
							<span class="i-lucide-globe h-4 w-4 mr-1"></span>
							Load All Entities
						</Button>

						{#if explorer.nodes.length > 0}
							<Button variant="ghost" size="sm" onclick={() => { explorer.clear(); searchResults = []; searchMeta = null; error = null; clearPath(); }}>
								<span class="i-lucide-trash-2 h-4 w-4 mr-1"></span>
								Clear
							</Button>
						{/if}

						{#if explorer.nodes.length > 0}
							<span class="stats-text">
								{explorer.nodes.length} node{explorer.nodes.length !== 1 ? 's' : ''},
								{explorer.edges.length} edge{explorer.edges.length !== 1 ? 's' : ''}
							</span>
						{/if}
					</div>
				</Stack>
			</Card>
		</section>

		{#if error}
			<Alert variant="error" title="Error">
				<p>{error}</p>
			</Alert>
		{/if}

		{#if searchMeta}
			<div class="meta-bar">
				<span>{searchMeta.seeds} seed{searchMeta.seeds !== 1 ? 's' : ''}</span>
				<span>+</span>
				<span>{searchMeta.graphDiscovered} graph-discovered</span>
				<span>&middot;</span>
				<span>{searchMeta.durationMs}ms</span>
			</div>
		{/if}

		<!-- EXPLORER -->
		<section id="explorer">
			{#if explorer.nodes.length > 0}
				{#if pathFromId || pathToId || pathHighlight}
					<div class="path-bar">
						<span class="path-label">
							<span class="i-lucide-route h-4 w-4"></span>
							Path:
						</span>
						<span class="path-endpoint">
							{pathFromId ? (explorer.nodes.find((n) => n.id === pathFromId)?.label ?? pathFromId) : '—'}
						</span>
						<span class="i-lucide-arrow-right h-4 w-4"></span>
						<span class="path-endpoint">
							{pathToId ? (explorer.nodes.find((n) => n.id === pathToId)?.label ?? pathToId) : '—'}
						</span>
						<Button
							variant="primary"
							size="sm"
							onclick={findPath}
							disabled={!pathFromId || !pathToId || pathFromId === pathToId || pathLoading}
						>
							{#if pathLoading}
								<Spinner size="xs" class="mr-1" />
							{/if}
							Find path
						</Button>
						<Button variant="ghost" size="sm" onclick={clearPath}>Clear</Button>
						{#if pathHighlight}
							<span class="path-info">{pathHighlight.nodeIds.size} nodes, {pathHighlight.edgeKeys.size} edges</span>
						{/if}
					</div>
				{/if}

				<div class="explorer-layout" class:has-detail={explorer.selectedNode}>
					<div class="graph-area">
						<KnowledgeGraph
							data={explorer.data}
							aspect="wide"
							ariaLabel="RAG entity graph"
							onNodeClick={handleNodeClick}
							highlightedNodeIds={pathHighlight?.nodeIds ?? null}
							highlightedEdgeKeys={pathHighlight?.edgeKeys ?? null}
						/>
					</div>

					{#if explorer.selectedNode}
						<div class="detail-area">
							<NodeDetailPanel
								node={explorer.selectedNode}
								edges={explorer.selectedNodeEdges}
								allNodes={explorer.nodes}
								expanded={explorer.isExpanded(explorer.selectedNode.id)}
								{expandLoading}
								onExpand={expandNode}
								onClose={handleCloseDetail}
								{pathFromId}
								{pathToId}
								onSetPathFrom={handleSetPathFrom}
								onSetPathTo={handleSetPathTo}
								onAskAbout={askAboutNode}
							/>
						</div>
					{/if}
				</div>
			{:else if !searchLoading && !graphLoading}
				<Card>
					<div class="empty-state">
						<span class="i-lucide-share-2 h-8 w-8 text-muted"></span>
						<Typography variant="muted" as="p">Search for entities or load the full graph to start exploring.</Typography>
					</div>
				</Card>
			{/if}
		</section>

		<!-- RESULTS -->
		{#if searchResults.length > 0}
			<section id="results">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Retrieved Chunks ({searchResults.length})</Typography>
					{/snippet}

					<Stack gap="3">
						{#each searchResults as result (result.chunkId)}
							<div class="result-card">
								<div class="result-header">
									<Badge variant={result.source === 'vector' ? 'default' : 'success'}>
										{result.source}
									</Badge>
									<span class="result-title">{result.documentTitle}</span>
									<span class="result-score">{result.score.toFixed(4)}</span>
								</div>
								<pre class="result-content">{result.content}</pre>
							</div>
						{/each}
					</Stack>
				</Card>
			</section>
		{/if}
	{/if}
</Stack>

<style>
	.search-form {
		display: flex;
		gap: var(--spacing-3);
	}

	.search-input {
		flex: 1;
		padding: var(--spacing-3) var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background-color: var(--color-surface-1);
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
		outline: none;
	}

	.search-input:focus {
		border-color: var(--color-primary);
	}

	.action-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.stats-text {
		margin-left: auto;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.meta-bar {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	/* ─── Path Bar ──────────────────────────────────────── */

	.path-bar {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-3) var(--spacing-4);
		margin-bottom: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface-1);
		flex-wrap: wrap;
		font-size: var(--text-fluid-sm);
	}

	.path-label {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		color: var(--color-muted);
		font-weight: 500;
	}

	.path-endpoint {
		color: var(--color-fg);
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		max-width: 140px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.path-info {
		margin-left: auto;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	/* ─── Explorer Layout ───────────────────────────────── */

	.explorer-layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--spacing-4);
		min-height: 500px;
	}

	.explorer-layout.has-detail {
		grid-template-columns: 1fr 300px;
	}

	@media (max-width: 768px) {
		.explorer-layout.has-detail {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr auto;
		}
	}

	.graph-area {
		min-height: 0;
		min-width: 0;
	}

	.detail-area {
		min-height: 0;
		max-height: 500px;
	}

	/* ─── Empty State ───────────────────────────────────── */

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-4);
		padding: var(--spacing-8) var(--spacing-4);
		text-align: center;
	}

	/* ─── Results ────────────────────────────────────────── */

	.result-card {
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.result-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		margin-bottom: var(--spacing-2);
	}

	.result-title {
		font-weight: 500;
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
	}

	.result-score {
		margin-left: auto;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-family: ui-monospace, monospace;
	}

	.result-content {
		white-space: pre-wrap;
		word-break: break-word;
		font-size: var(--text-fluid-xs);
		color: var(--color-fg);
		background-color: var(--color-surface-2);
		padding: var(--spacing-3);
		border-radius: var(--radius-sm);
		margin: 0;
		max-height: 150px;
		overflow-y: auto;
	}
</style>
