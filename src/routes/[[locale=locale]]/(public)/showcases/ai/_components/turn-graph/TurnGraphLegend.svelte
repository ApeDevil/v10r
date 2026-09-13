<script lang="ts">
import { Badge } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { EDGE_KIND_LABELS, STATE_LABELS } from '$lib/showcases/ai/labels';
import type { TurnGraphEdgeKind } from '$lib/showcases/ai/turn-graph';
import type { TurnItemState } from '$lib/types/turn-trace';

// What the strokes and chips mean, always in view — one line under the canvas, words beside
// every swatch so colour never carries it alone. Containment is a box inside a box (the
// canvas nests it), every other relation a line with an arrow.
const EDGES: Exclude<TurnGraphEdgeKind, 'containment'>[] = ['inclusion', 'request', 'execution', 'result', 'citation'];
const STATES: TurnItemState[] = ['considered', 'included', 'executed', 'cited'];
const stateVariant = (state: TurnItemState) =>
	state === 'cited' ? 'success' : state === 'executed' ? 'default' : 'secondary';
</script>

<ul class="legend" aria-label={m.showcase_ai_graph_legend()}>
	<li class="item">
		<svg class="swatch" viewBox="0 0 40 16" aria-hidden="true">
			<rect x="0.5" y="0.5" width="39" height="15" rx="2" class="box" />
			<rect x="8" y="5" width="26" height="7" rx="1.5" class="box inner" />
		</svg>
		<span>{EDGE_KIND_LABELS.containment()}</span>
	</li>
	{#each EDGES as kind (kind)}
		<li class="item">
			<svg class="swatch" viewBox="0 0 40 16" aria-hidden="true">
				<line x1="0" y1="8" x2="33" y2="8" class="stroke stroke-{kind}" />
				<polygon points="32,4 40,8 32,12" class="arrow arrow-{kind}" />
			</svg>
			<span>{EDGE_KIND_LABELS[kind]()}</span>
		</li>
	{/each}
	<li class="divider" aria-hidden="true"></li>
	{#each STATES as state (state)}
		<li class="item"><Badge variant={stateVariant(state)} class="legend-badge">{STATE_LABELS[state]()}</Badge></li>
	{/each}
</ul>

<style>
	.legend {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-1) var(--spacing-4);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.item {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		white-space: nowrap;
	}

	.divider {
		width: 1px;
		height: 0.9em;
		background: var(--color-border);
	}

	.swatch {
		width: 40px;
		height: 16px;
		flex-shrink: 0;
	}

	.box {
		fill: color-mix(in srgb, var(--chart-2) 8%, transparent);
		stroke: var(--color-border);
		stroke-width: 1;
	}

	.box.inner {
		fill: var(--surface-2);
	}

	.legend :global(.legend-badge) {
		font-size: 10px;
		line-height: 1.4;
		padding: 0 6px;
	}

	.stroke {
		stroke: var(--color-border);
		stroke-width: 1.5;
	}

	.arrow {
		fill: var(--color-border);
	}

	.stroke-citation {
		stroke-dasharray: 1.5 3.5;
		stroke-linecap: round;
		stroke: var(--color-primary);
	}

	.arrow-citation {
		fill: var(--color-primary);
	}

	.stroke-execution,
	.stroke-result {
		stroke: var(--color-fg);
	}

	.arrow-execution,
	.arrow-result {
		fill: var(--color-fg);
	}
</style>
