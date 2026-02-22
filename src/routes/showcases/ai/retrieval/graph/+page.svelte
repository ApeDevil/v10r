<script lang="ts">
	import { PageHeader, BackLink, Card, Alert } from '$lib/components/composites';
	import { Typography, Button } from '$lib/components/primitives';
	import { PageContainer, Stack } from '$lib/components/layout';

	let { data } = $props();

	let query = $state('');
	let loading = $state(false);
	let results: Array<{
		chunkId: string;
		documentTitle: string;
		content: string;
		score: number;
		source: string;
		tier: number;
	}> = $state([]);
	let entities: Array<{
		name: string;
		type: string;
		related: string[];
	}> = $state([]);
	let meta: { durationMs: number; tierUsed: number[] } | null = $state(null);
	let error: string | null = $state(null);
	let searched = $state(false);

	async function search() {
		if (!query.trim() || loading) return;

		loading = true;
		error = null;

		try {
			const res = await fetch('/api/retrieval/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query: query.trim(), tiers: [3], maxChunks: 8, graphDepth: 2 }),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error ?? `HTTP ${res.status}`);
			}

			const data = await res.json();
			results = data.chunks ?? [];
			entities = data.entities ?? [];
			meta = { durationMs: data.durationMs, tierUsed: data.tierUsed };
			searched = true;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Search failed';
			results = [];
			entities = [];
			meta = null;
		} finally {
			loading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			search();
		}
	}

	const seedChunks = $derived(results.filter(r => r.source === 'vector'));
	const graphChunks = $derived(results.filter(r => r.source === 'graph'));
</script>

<svelte:head>
	<title>Graph Search - Retrieval - AI - Showcases - Velociraptor</title>
</svelte:head>

<PageContainer class="py-7">
	<PageHeader
		title="Tier 3: Graph Traversal"
		description="Seeds from vector search, then expands through entity relationships in Neo4j. Discovers related chunks that aren't semantically similar but are structurally connected."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'AI', href: '/showcases/ai' },
			{ label: 'Retrieval', href: '/showcases/ai/retrieval' },
			{ label: 'Graph' }
		]}
	/>

	<Stack gap="6">
		{#if !data.configured}
			<Alert variant="info" title="AI Not Configured">
				<p>Configure AI + Neo4j and ingest documents with entity extraction to use graph retrieval.</p>
			</Alert>
		{:else}
			<Card>
				{#snippet header()}
					<Typography variant="h5" as="h2">Graph-Expanded Search</Typography>
				{/snippet}

				<Stack gap="4">
					<div class="info-box">
						<span class="i-lucide-info h-4 w-4 text-primary shrink-0"></span>
						<p class="text-fluid-xs text-muted m-0">
							Step 1: Vector search finds seed chunks.
							Step 2: Neo4j traverses MENTIONS and RELATED_TO edges (max 2 hops).
							Step 3: Graph-discovered chunk content is fetched from Postgres.
						</p>
					</div>

					<div class="search-form">
						<input
							type="text"
							bind:value={query}
							onkeydown={handleKeydown}
							placeholder="Enter a search query..."
							class="search-input"
							disabled={loading}
							aria-label="Search query"
						/>
						<Button variant="primary" onclick={search} disabled={loading || !query.trim()}>
							{#if loading}
								<span class="i-lucide-loader-2 h-4 w-4 animate-spin"></span>
							{:else}
								<span class="i-lucide-share-2 h-4 w-4"></span>
							{/if}
							Search
						</Button>
					</div>
				</Stack>
			</Card>

			{#if meta}
				<div class="meta-bar">
					<span>{seedChunks.length} seed{seedChunks.length !== 1 ? 's' : ''}</span>
					<span>+</span>
					<span>{graphChunks.length} graph-discovered</span>
					<span>·</span>
					<span>{meta.durationMs}ms</span>
				</div>
			{/if}

			{#if error}
				<Alert variant="error" title="Search Failed">
					<p>{error}</p>
				</Alert>
			{/if}

			{#if searched && results.length === 0 && !error}
				<p class="text-fluid-sm text-muted text-center py-6">No results found for this query.</p>
			{/if}

			{#if results.length > 0}
				<div class="results-layout">
					<div class="results-main">
						<Stack gap="4">
							{#if seedChunks.length > 0}
								<Typography variant="h6" as="h3" class="text-muted">Vector Seeds</Typography>
								{#each seedChunks as result, i (result.chunkId)}
									<Card>
										<div class="result-header">
											<span class="result-badge seed">seed</span>
											<span class="result-title">{result.documentTitle}</span>
											<span class="result-score">{result.score.toFixed(4)}</span>
										</div>
										<pre class="result-content">{result.content}</pre>
									</Card>
								{/each}
							{/if}

							{#if graphChunks.length > 0}
								<Typography variant="h6" as="h3" class="text-muted">Graph-Discovered</Typography>
								{#each graphChunks as result (result.chunkId)}
									<Card>
										<div class="result-header">
											<span class="result-badge graph">graph</span>
											<span class="result-title">{result.documentTitle}</span>
											<span class="result-score">{result.score.toFixed(4)}</span>
										</div>
										<pre class="result-content">{result.content}</pre>
									</Card>
								{/each}
							{/if}
						</Stack>
					</div>

					{#if entities.length > 0}
						<div class="entities-sidebar">
							<Card>
								{#snippet header()}
									<Typography variant="h6" as="h3">Entities ({entities.length})</Typography>
								{/snippet}

								<div class="entity-list">
									{#each entities as entity (entity.name)}
										<div class="entity-item">
											<span class="entity-type">{entity.type}</span>
											<span class="entity-name">{entity.name}</span>
											{#if entity.related.length > 0}
												<span class="entity-related text-fluid-xs text-muted">
													&rarr; {entity.related.slice(0, 3).join(', ')}
												</span>
											{/if}
										</div>
									{/each}
								</div>
							</Card>
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</Stack>

	<BackLink href="/showcases/ai/retrieval" label="Retrieval" />
</PageContainer>

<style>
	.info-box {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-3);
		padding: var(--spacing-3) var(--spacing-4);
		background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
		border-radius: var(--radius-lg);
	}

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

	.meta-bar {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.results-layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--spacing-6);
	}

	@media (min-width: 768px) {
		.results-layout {
			grid-template-columns: 1fr 280px;
		}
	}

	.result-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		margin-bottom: var(--spacing-3);
	}

	.result-title {
		font-weight: 500;
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
	}

	.result-badge {
		font-size: var(--text-fluid-xs);
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		font-weight: 500;
	}

	.result-badge.seed {
		background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
		color: var(--color-primary);
	}

	.result-badge.graph {
		background-color: color-mix(in srgb, var(--color-success) 12%, transparent);
		color: var(--color-success);
	}

	.result-score {
		margin-left: auto;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-family: monospace;
	}

	.result-content {
		white-space: pre-wrap;
		word-break: break-word;
		font-size: var(--text-fluid-xs);
		color: var(--color-fg);
		background-color: var(--color-surface-2);
		padding: var(--spacing-4);
		border-radius: var(--radius-md);
		margin: 0;
		max-height: 200px;
		overflow-y: auto;
	}

	.entity-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.entity-item {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.entity-type {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
	}

	.entity-name {
		font-weight: 500;
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
	}
</style>
