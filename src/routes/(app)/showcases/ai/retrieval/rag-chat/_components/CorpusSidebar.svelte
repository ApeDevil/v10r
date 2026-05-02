<script lang="ts">
import { onMount } from 'svelte';

interface RetrievalStats {
	corpus: { documents: number; chunks: number; tokens: number };
	tiers: {
		vector: { vectors: number; dimensions: number; model: string };
		parentChild: { parents: number; children: number };
		graph: { nodes: number; edges: number };
	};
}

let stats = $state<RetrievalStats | null>(null);
let error = $state<string | null>(null);

async function load() {
	try {
		const res = await fetch('/api/retrieval/stats');
		if (!res.ok) {
			error = `HTTP ${res.status}`;
			return;
		}
		const json = await res.json();
		stats = json.data;
	} catch (err) {
		error = err instanceof Error ? err.message : 'Failed to load stats';
	}
}

onMount(load);
</script>

<aside class="corpus-sidebar" aria-label="Corpus overview">
	<header class="head">
		<span class="i-lucide-database h-3 w-3" aria-hidden="true"></span>
		<h3 class="title">Corpus</h3>
	</header>

	{#if error}
		<p class="error">{error}</p>
	{:else if !stats}
		<p class="loading">Loading…</p>
	{:else}
		<dl class="stat-grid">
			<dt>Documents</dt>
			<dd>{stats.corpus.documents}</dd>
			<dt>Chunks</dt>
			<dd>{stats.corpus.chunks}</dd>
			<dt>Tokens</dt>
			<dd>{stats.corpus.tokens.toLocaleString()}</dd>
		</dl>

		<div class="divider"></div>

		<section class="tier-section">
			<h4 class="tier-title">Vector</h4>
			<p class="tier-line">
				{stats.tiers.vector.vectors} vectors · {stats.tiers.vector.dimensions}d
			</p>
			<p class="tier-line muted">{stats.tiers.vector.model}</p>
		</section>

		<section class="tier-section">
			<h4 class="tier-title">Small-to-Big</h4>
			<p class="tier-line">
				{stats.tiers.parentChild.children} children / {stats.tiers.parentChild.parents} parents
			</p>
		</section>

		<section class="tier-section">
			<h4 class="tier-title">Entity Graph</h4>
			<p class="tier-line">
				{stats.tiers.graph.nodes} nodes · {stats.tiers.graph.edges} edges
			</p>
		</section>
	{/if}
</aside>

<style>
	.corpus-sidebar {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface-1);
		font-size: 12px;
	}

	.head {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 10px;
	}

	.title {
		margin: 0;
		font-size: 11px;
		font-weight: 600;
		color: var(--color-fg);
	}

	.loading,
	.error {
		margin: 0;
		color: var(--color-muted);
	}

	.error {
		color: var(--color-error-fg);
	}

	.stat-grid {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--spacing-1) var(--spacing-3);
		margin: 0;
	}

	.stat-grid dt {
		color: var(--color-muted);
		font-weight: 500;
	}

	.stat-grid dd {
		margin: 0;
		color: var(--color-fg);
		font-weight: 600;
		text-align: right;
	}

	.divider {
		height: 1px;
		background: var(--color-border);
	}

	.tier-section {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.tier-title {
		margin: 0;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
	}

	.tier-line {
		margin: 0;
		color: var(--color-fg);
	}

	.tier-line.muted {
		color: var(--color-muted);
		font-size: 11px;
	}
</style>
