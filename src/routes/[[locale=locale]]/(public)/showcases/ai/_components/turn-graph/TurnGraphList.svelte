<script lang="ts">
import * as m from '$lib/paraglide/messages';
import { BLOCK_TAGS, COLUMN_LABELS, EDGE_KIND_LABELS, KIND_LABELS } from '$lib/showcases/ai/labels';
import {
	connectedIds,
	type TurnGraph,
	type TurnGraphColumn,
	type TurnGraphEdge,
	type TurnGraphNode,
	visibleTurnGraph,
} from '$lib/showcases/ai/turn-graph';
import TurnGraphCard from './TurnGraphCard.svelte';

// The turn graph as three lists in reading order — sources, context and model calls, tools —
// for narrow screens and for anyone who would rather not pan a canvas. Every card is a
// button; the relations an edge would draw are written under it, so nothing depends on
// seeing a line. Same projection, same selection, same expansion as the canvas.
interface Props {
	graph: TurnGraph;
	expanded: ReadonlySet<string>;
	selectedId: string | null;
	callId: string | null;
	onselect: (id: string | null) => void;
	ontoggle: (id: string) => void;
}

let { graph, expanded, selectedId, callId, onselect, ontoggle }: Props = $props();

const COLUMNS: TurnGraphColumn[] = ['sources', 'context', 'tools'];
const DIMMED_KINDS = new Set(['prompt', 'block', 'history', 'call', 'tool']);
const fmt = (n: number) => n.toLocaleString();

const visible = $derived(visibleTurnGraph(graph, expanded));
const connected = $derived(connectedIds(visible, selectedId));
const byId = $derived(new Map(visible.nodes.map((n) => [n.id, n])));

const nameOf = (node: TurnGraphNode): string => {
	const detail = node.detail;
	if (detail?.kind === 'block') return BLOCK_TAGS[detail.block.id] ?? detail.block.id;
	if (detail?.kind === 'call') return m.showcase_ai_graph_call_n({ n: String(detail.index + 1) });
	if (
		node.kind === 'prompt' ||
		node.kind === 'history' ||
		node.kind === 'toolset' ||
		node.kind === 'answer' ||
		node.kind === 'omitted'
	) {
		return KIND_LABELS[node.kind]();
	}
	return node.label;
};

/** The relations written under a card: outgoing as "verb → target", incoming as "source → verb". */
const relationsOf = (id: string): string[] =>
	visible.edges
		.filter((e) => e.kind !== 'containment' && (e.source === id || e.target === id))
		.map((e: TurnGraphEdge) => {
			const other = byId.get(e.source === id ? e.target : e.source);
			const name = other ? nameOf(other) : '';
			const merged = e.merged && e.merged > 1 ? ` ${m.showcase_ai_graph_edge_merged({ n: fmt(e.merged) })}` : '';
			return e.source === id
				? `${EDGE_KIND_LABELS[e.kind]()} → ${name}${merged}`
				: `${name} → ${EDGE_KIND_LABELS[e.kind]()}${merged}`;
		});

const dimmedOf = (node: TurnGraphNode): boolean =>
	(selectedId !== null && !connected.nodes.has(node.id)) ||
	(callId !== null && DIMMED_KINDS.has(node.kind) && !node.flags.inCall);
</script>

<div class="lists" role="group" aria-label={m.showcase_ai_graph_aria()}>
	{#each COLUMNS as column (column)}
		<section class="column" aria-labelledby="turn-graph-column-{column}">
			<h4 id="turn-graph-column-{column}" class="column-title">{COLUMN_LABELS[column]()}</h4>
			<ul class="rows">
				{#each visible.nodes.filter((n) => n.column === column) as node (node.id)}
					{@const relations = relationsOf(node.id)}
					<li class="row" style:--depth={node.depth}>
						{#if node.kind === 'boundary'}
							<TurnGraphCard {node} />
						{:else}
							<div class="row-head">
								<button
									type="button"
									class="card-button"
									aria-pressed={selectedId === node.id}
									onclick={() => onselect(selectedId === node.id ? null : node.id)}
								>
									<TurnGraphCard
										{node}
										selected={selectedId === node.id}
										connected={connected.nodes.has(node.id) && node.id !== selectedId}
										dimmed={dimmedOf(node)}
										expanded={expanded.has(node.id)}
									/>
								</button>
								{#if node.expandable}
									<button
										type="button"
										class="expand"
										aria-expanded={expanded.has(node.id)}
										aria-label={expanded.has(node.id)
											? m.showcase_ai_graph_collapse()
											: m.showcase_ai_graph_expand({ n: fmt(node.count ?? 0) })}
										onclick={() => ontoggle(node.id)}
									>
										<span class={expanded.has(node.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'} aria-hidden="true"></span>
									</button>
								{/if}
							</div>
							{#if relations.length > 0}
								<ul class="relations">
									{#each relations as relation, i (i)}
										<li>{relation}</li>
									{/each}
								</ul>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<style>
	.lists {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.column-title {
		margin: 0 0 var(--spacing-2);
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-muted);
	}

	.rows,
	.relations {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.row {
		padding-left: calc(var(--depth, 0) * var(--spacing-3));
		min-width: 0;
	}

	.row-head {
		display: flex;
		align-items: stretch;
		gap: var(--spacing-1);
	}

	.card-button {
		flex: 1;
		min-width: 0;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
		text-align: left;
		border-radius: var(--radius-md);
	}

	.card-button:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--color-primary);
	}

	.expand {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--surface-2);
		color: var(--color-muted);
		cursor: pointer;
	}

	.expand:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--color-primary);
	}

	.relations {
		margin-top: var(--spacing-1);
		padding-left: var(--spacing-3);
		display: flex;
		flex-direction: column;
		gap: 1px;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
</style>
