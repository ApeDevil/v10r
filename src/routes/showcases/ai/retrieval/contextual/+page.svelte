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
				body: JSON.stringify({ query: query.trim(), tiers: [1], maxChunks: 10 }),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error ?? `HTTP ${res.status}`);
			}

			const data = await res.json();
			results = data.chunks ?? [];
			meta = { durationMs: data.durationMs, tierUsed: data.tierUsed };
			searched = true;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Search failed';
			results = [];
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
</script>

<svelte:head>
	<title>Contextual Search - Retrieval - AI - Showcases - Velociraptor</title>
</svelte:head>

<PageContainer class="py-7">
	<PageHeader
		title="Tier 1: Contextual Search"
		description="Hybrid retrieval combining pgvector cosine similarity with Postgres BM25 full-text search, fused via reciprocal rank fusion."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'AI', href: '/showcases/ai' },
			{ label: 'Retrieval', href: '/showcases/ai/retrieval' },
			{ label: 'Contextual' }
		]}
	/>

	<Stack gap="6">
		{#if !data.configured}
			<Alert variant="info" title="AI Not Configured">
				<p>Configure an AI provider and ingest documents to use contextual search.</p>
			</Alert>
		{:else}
			<Card>
				{#snippet header()}
					<Typography variant="h5" as="h2">Search Documents</Typography>
				{/snippet}

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
							<span class="i-lucide-search h-4 w-4"></span>
						{/if}
						Search
					</Button>
				</div>
			</Card>

			{#if meta}
				<div class="meta-bar">
					<span>{results.length} results</span>
					<span>·</span>
					<span>{meta.durationMs}ms</span>
					<span>·</span>
					<span>Tier {meta.tierUsed.join(', ')}</span>
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
				<Stack gap="4">
					{#each results as result, i (result.chunkId)}
						<Card>
							<div class="result-header">
								<span class="result-rank">#{i + 1}</span>
								<span class="result-title">{result.documentTitle}</span>
								<span class="result-score">
									{result.source === 'vector' ? 'vec' : 'bm25'}
									· {result.score.toFixed(4)}
								</span>
							</div>
							<pre class="result-content">{result.content}</pre>
						</Card>
					{/each}
				</Stack>
			{/if}
		{/if}
	</Stack>

	<BackLink href="/showcases/ai/retrieval" label="Retrieval" />
</PageContainer>

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

	.meta-bar {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.result-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		margin-bottom: var(--spacing-3);
	}

	.result-rank {
		font-weight: 700;
		color: var(--color-primary);
		font-size: var(--text-fluid-sm);
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
</style>
