<script lang="ts">
import { cn } from '$lib/utils/cn';
import type { ErdEdge, ErdTable } from './types';

interface Props {
	tables: ErdTable[];
	edges: ErdEdge[];
	/** Table names to emphasize; others are dimmed. Empty = all equal. */
	highlight?: string[];
	ariaLabel?: string;
	class?: string;
}

let { tables, edges, highlight = [], ariaLabel = 'Entity relationship diagram', class: className }: Props =
	$props();

function dimmed(name: string): boolean {
	return highlight.length > 0 && !highlight.includes(name);
}
</script>

<figure class={cn('erd', className)} aria-label={ariaLabel}>
	<figcaption class="sr-only">{ariaLabel}</figcaption>

	<div class="erd-grid">
		{#each tables as table (table.name)}
			<section class="erd-table" class:dim={dimmed(table.name)}>
				<header class="erd-table-head">
					{#if table.schema}<span class="erd-schema">{table.schema}.</span>{/if}{table.name}
				</header>
				<ul class="erd-cols">
					{#each table.columns as col (col.name)}
						<li class="erd-col">
							<span class="erd-col-name">
								{col.name}
								{#if col.pk}<span class="erd-tag erd-pk" title="primary key">PK</span>{/if}
								{#if col.fk}<span class="erd-tag erd-fk" title="foreign key">FK</span>{/if}
								{#if col.secret}<span class="erd-tag erd-secret" title="never selected by any query"
										>&#128274;</span
									>{/if}
							</span>
							<span class="erd-col-type">{col.type}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>

	<ul class="erd-edges" aria-label="Relationships and ON DELETE behavior">
		{#each edges as edge (edge.fk)}
			<li class="erd-edge" class:dim={dimmed(edge.from) && dimmed(edge.to)}>
				<span class="erd-edge-path">
					<strong>{edge.from}</strong>
					<span class="erd-arrow" aria-hidden="true">&rarr;</span>
					<strong>{edge.to}</strong>
				</span>
				<span
					class="erd-ondelete"
					class:cascade={edge.onDelete === 'cascade'}
					class:nofk={edge.onDelete === 'no action (no FK)'}
				>
					ON DELETE {edge.onDelete}
				</span>
				{#if edge.note}<span class="erd-edge-note">{edge.note}</span>{/if}
			</li>
		{/each}
	</ul>
</figure>

<style>
	.erd {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-4, 1rem);
	}

	.erd-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--space-3, 0.75rem);
	}

	.erd-table {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--surface-1);
		overflow: hidden;
		transition: opacity 0.15s ease;
	}

	.erd-table.dim,
	.erd-edge.dim {
		opacity: 0.35;
	}

	.erd-table-head {
		font-weight: 600;
		font-size: 0.875rem;
		padding: 0.5rem 0.75rem;
		background: var(--color-subtle);
		border-bottom: 1px solid var(--color-border);
		color: var(--color-fg);
	}

	.erd-schema {
		color: var(--color-muted);
		font-weight: 400;
	}

	.erd-cols {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.erd-col {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.3rem 0.75rem;
		font-size: 0.8125rem;
		border-bottom: 1px solid var(--color-border);
	}

	.erd-col:last-child {
		border-bottom: none;
	}

	.erd-col-name {
		color: var(--color-fg);
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.erd-col-type {
		color: var(--color-muted);
		font-family: var(--font-mono, monospace);
		font-size: 0.75rem;
	}

	.erd-tag {
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		padding: 0 0.25rem;
		border-radius: var(--radius-sm, 0.25rem);
		line-height: 1.4;
	}

	.erd-pk {
		background: color-mix(in srgb, var(--color-primary) 18%, transparent);
		color: var(--color-primary);
	}

	.erd-fk {
		background: color-mix(in srgb, var(--color-fg) 12%, transparent);
		color: var(--color-fg);
	}

	.erd-secret {
		background: color-mix(in srgb, var(--color-warning, orange) 20%, transparent);
	}

	.erd-edges {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.erd-edge {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem 0.75rem;
		font-size: 0.8125rem;
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--surface-1);
		transition: opacity 0.15s ease;
	}

	.erd-edge-path {
		color: var(--color-fg);
	}

	.erd-arrow {
		color: var(--color-muted);
		margin: 0 0.2rem;
	}

	.erd-ondelete {
		font-family: var(--font-mono, monospace);
		font-size: 0.6875rem;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.erd-ondelete.cascade {
		color: var(--color-primary);
	}

	.erd-ondelete.nofk {
		color: var(--color-warning, orange);
	}

	.erd-edge-note {
		color: var(--color-muted);
		flex-basis: 100%;
		font-size: 0.75rem;
	}
</style>
