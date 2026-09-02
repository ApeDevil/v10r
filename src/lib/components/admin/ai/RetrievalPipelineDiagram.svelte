<script lang="ts">
import { RETRIEVAL_CORPORA, RETRIEVAL_READ_PATH, type RetrievalCorpusId } from './retrieval-pipeline';

interface Props {
	/** Live counts per layer (null = not yet measured). */
	counts: Partial<Record<RetrievalCorpusId, number | null>>;
}

let { counts }: Props = $props();

function fmt(v: number | null | undefined): string {
	return v == null ? '—' : v.toLocaleString();
}
</script>

<div class="pipeline">
	<!-- Decorative flow — the table + list below carry the actual semantics. -->
	<div class="flow" aria-hidden="true">
		{#each RETRIEVAL_READ_PATH as step, i (step.n)}
			<div class="flow-node">
				<span class="flow-n">{step.n}</span>
				<span class="flow-label">{step.label}</span>
			</div>
			{#if i < RETRIEVAL_READ_PATH.length - 1}
				<span class="flow-arrow i-lucide-arrow-right" aria-hidden="true"></span>
			{/if}
		{/each}
	</div>

	<!-- Stores (primary accessible representation) -->
	<div class="table-wrap" tabindex="0" aria-label="Retrieval corpora">
		<table class="layers">
			<caption>Retrieval layers</caption>
			<thead>
				<tr>
					<th scope="col">Layer</th>
					<th scope="col">Role</th>
					<th scope="col">Backing store</th>
					<th scope="col">Count</th>
				</tr>
			</thead>
			<tbody>
				{#each RETRIEVAL_CORPORA as layer (layer.id)}
					<tr>
						<td><code class="layer-name">{layer.label}</code></td>
						<td>{layer.role}</td>
						<td><code class="store">{layer.store}</code></td>
						<td><code class="count">{fmt(counts[layer.id])}</code></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Read path (text equivalent of the flow) -->
	<div class="read-path">
		<h4 class="sub">Chat read path</h4>
		<ol>
			{#each RETRIEVAL_READ_PATH as step (step.n)}
				<li><span class="step-label">{step.label}</span> — {step.detail}</li>
			{/each}
		</ol>
	</div>

</div>

<style>
	.pipeline {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	/* Decorative flow */
	.flow {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		overflow-x: auto;
		padding-bottom: var(--spacing-2);
		scrollbar-width: thin;
	}

	.flow-node {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-shrink: 0;
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
		white-space: nowrap;
	}

	.flow-n {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: var(--radius-full);
		background: var(--color-primary);
		color: var(--color-bg);
		font-size: 0.7rem;
		font-weight: 700;
	}

	.flow-label {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
	}

	.flow-arrow {
		flex-shrink: 0;
		width: 1rem;
		height: 1rem;
		color: var(--color-muted);
	}

	/* Layers table */
	.table-wrap {
		overflow-x: auto;
	}

	.table-wrap:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.layers {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.layers caption {
		text-align: left;
		font-weight: 600;
		color: var(--color-muted);
		padding-bottom: var(--spacing-2);
	}

	.layers th {
		text-align: left;
		padding: var(--spacing-2) var(--spacing-3);
		font-weight: 600;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.layers td {
		padding: var(--spacing-2) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
		vertical-align: top;
	}

	.layer-name {
		font-family: ui-monospace, monospace;
		font-weight: 600;
		font-size: var(--text-fluid-xs);
	}

	.store {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.count {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
		font-weight: 700;
	}

	/* Read path */
	.read-path .sub {
		margin: 0 0 var(--spacing-2);
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-muted);
	}

	.read-path ol {
		margin: 0;
		padding-left: var(--spacing-5);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.step-label {
		font-weight: 600;
		color: var(--color-fg);
	}
</style>
