<script lang="ts">
import { Handle, type Node, type NodeProps, Position } from '@xyflow/svelte';
import * as m from '$lib/paraglide/messages';
import type { TurnGraphNode } from '$lib/showcases/ai/turn-graph';
import { GROUP_HEADER } from '$lib/showcases/ai/turn-graph-layout';
import TurnGraphCard from './TurnGraphCard.svelte';

// A node with visible members: a bordered box, tinted deeper with each nesting level, whose
// header is the record's card and whose members are their own nodes drawn inside it — the
// nesting is the containment, so no edge needs to say it. Edges attach to the header row.
interface TurnGraphGroupData extends Record<string, unknown> {
	node: TurnGraphNode;
	connected: boolean;
	dimmed: boolean;
	expanded: boolean;
	ontoggle: (id: string) => void;
}

let { data, selected }: NodeProps<Node<TurnGraphGroupData>> = $props();
const fmt = (n: number) => n.toLocaleString();
const handleStyle = `top: ${GROUP_HEADER / 2}px`;
</script>

<Handle id="l-in" type="target" position={Position.Left} isConnectable={false} class="turn-handle" style={handleStyle} />
<Handle id="r-in" type="target" position={Position.Right} isConnectable={false} class="turn-handle" style={handleStyle} />
<Handle id="r-out" type="source" position={Position.Right} isConnectable={false} class="turn-handle" style={handleStyle} />
<Handle id="l-out" type="source" position={Position.Left} isConnectable={false} class="turn-handle" style={handleStyle} />

<div
	class="group"
	class:selected={selected ?? false}
	class:connected={data.connected}
	class:dimmed={data.dimmed}
	data-column={data.node.column}
	data-depth={Math.min(data.node.depth, 3)}
>
	<div class="group-header" style:height="{GROUP_HEADER}px">
		<TurnGraphCard node={data.node} variant="header" expanded={data.expanded} />
	</div>
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
	.group {
		position: relative;
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		border: 1px solid var(--color-border);
		border-left: 3px solid var(--turn-accent);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--turn-accent) var(--turn-tint), var(--surface-1));
		--turn-card-inset: 26px;
		--turn-tint: 5%;
		transition:
			border-color var(--duration-fast),
			opacity var(--duration-fast),
			box-shadow var(--duration-fast);
	}

	.group[data-column='sources'] {
		--turn-accent: var(--chart-2);
	}

	.group[data-column='context'] {
		--turn-accent: var(--chart-1);
	}

	.group[data-column='tools'] {
		--turn-accent: var(--chart-5);
	}

	.group[data-depth='1'] {
		--turn-tint: 9%;
	}

	.group[data-depth='2'] {
		--turn-tint: 13%;
	}

	.group[data-depth='3'] {
		--turn-tint: 17%;
	}

	.group-header {
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
	}

	.group.connected {
		border-color: var(--color-primary);
	}

	.group.selected {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-primary);
	}

	.group.dimmed {
		opacity: 0.45;
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

	@media (prefers-reduced-motion: reduce) {
		.group {
			transition: none;
		}
	}
</style>
