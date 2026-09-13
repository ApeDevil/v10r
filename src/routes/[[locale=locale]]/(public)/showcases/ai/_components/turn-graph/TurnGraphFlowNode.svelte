<script lang="ts">
import { Handle, type Node, type NodeProps, Position } from '@xyflow/svelte';
import * as m from '$lib/paraglide/messages';
import type { TurnGraphNode } from '$lib/showcases/ai/turn-graph';
import type { TurnGraphCardVariant } from '$lib/showcases/ai/turn-graph-layout';
import TurnGraphCard from './TurnGraphCard.svelte';

// The Svelte Flow node type of the turn graph: the card (standalone, or a member row inside a
// group), four invisible handles the edges attach to — every route leaves and enters by a
// side — and the expand toggle, a real button that neither drags nor pans the canvas.
interface TurnGraphNodeData extends Record<string, unknown> {
	node: TurnGraphNode;
	variant: TurnGraphCardVariant;
	connected: boolean;
	dimmed: boolean;
	expanded: boolean;
	ontoggle: (id: string) => void;
}

let { data, selected }: NodeProps<Node<TurnGraphNodeData>> = $props();
const fmt = (n: number) => n.toLocaleString();
</script>

<Handle id="l-in" type="target" position={Position.Left} isConnectable={false} class="turn-handle" />
<Handle id="r-in" type="target" position={Position.Right} isConnectable={false} class="turn-handle" />
<Handle id="r-out" type="source" position={Position.Right} isConnectable={false} class="turn-handle" />
<Handle id="l-out" type="source" position={Position.Left} isConnectable={false} class="turn-handle" />

<div class="flow-card">
	<TurnGraphCard
		node={data.node}
		variant={data.variant}
		selected={selected ?? false}
		connected={data.connected}
		dimmed={data.dimmed}
		expanded={data.expanded}
	/>
	{#if data.node.expandable}
		<button
			type="button"
			class="expand nodrag nopan"
			aria-expanded={data.expanded}
			aria-label={data.expanded ? m.showcase_ai_graph_collapse() : m.showcase_ai_graph_expand({ n: fmt(data.node.count ?? 0) })}
			onclick={(e) => {
				e.stopPropagation();
				data.ontoggle(data.node.id);
			}}
		>
			<span class={data.expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'} aria-hidden="true"></span>
		</button>
	{/if}
</div>

<style>
	.flow-card {
		position: relative;
		width: 100%;
		height: 100%;
		--turn-card-inset: 26px;
	}

	/* The card is the whole node; the handles are anchors, never targets. */
	:global(.svelte-flow__handle.turn-handle) {
		opacity: 0;
		pointer-events: none;
		width: 1px;
		height: 1px;
		min-width: 0;
		min-height: 0;
	}

	.expand {
		position: absolute;
		top: 3px;
		right: 3px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
	}

	.expand:hover,
	.expand:focus-visible {
		color: var(--color-fg);
		border-color: var(--color-border);
		outline: none;
	}

	.expand:focus-visible {
		box-shadow: 0 0 0 2px var(--color-primary);
	}
</style>
