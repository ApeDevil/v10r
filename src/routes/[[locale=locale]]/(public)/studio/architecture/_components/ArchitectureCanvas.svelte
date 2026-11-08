<script lang="ts">
import type { Edge, Node, NodeTypes } from '@xyflow/svelte';
import { onMount } from 'svelte';
import { FlowDiagram } from '#lib/components/viz/index.ts';
import * as m from '#lib/paraglide/messages.js';
import {
	type ArchitectureFinding,
	type ArchitectureLayout,
	type ArchitectureModel,
	NODE_KINDS,
	PLACEMENT_LABELS,
} from '#patterns/architecture-engineering/index.ts';

/**
 * The diagram is a projection of the model: nodes and edges are rebuilt from the model and
 * the separate layout on every change, and the canvas only reports gestures back (select,
 * connect, drag end). It never holds an edit of its own.
 */
interface Props {
	model: ArchitectureModel;
	layout: ArchitectureLayout;
	findings: readonly ArchitectureFinding[];
	selectedId: string | null;
	onselect: (id: string | null) => void;
	onconnect: (from: string, to: string) => void;
	onmove: (id: string, position: { x: number; y: number }) => void;
}

let { model, layout, findings, selectedId, onselect, onconnect, onmove }: Props = $props();

let nodeTypes = $state<NodeTypes | undefined>();

onMount(async () => {
	const module = await import('./ArchitectureFlowNode.svelte');
	nodeTypes = { architecture: module.default } as NodeTypes;
});

const zoneOf = $derived(new Map(model.zones.map((zone) => [zone.id, zone])));

function count(subject: string, severity: ArchitectureFinding['severity']): number {
	return findings.filter((entry) => entry.subject === subject && entry.severity === severity).length;
}

const nodes = $derived<Node[]>(
	model.nodes.map((node, index) => ({
		id: node.id,
		type: 'architecture',
		position: layout.positions[node.id] ?? { x: 40 + (index % 4) * 240, y: 40 + Math.floor(index / 4) * 140 },
		data: {
			label: node.label,
			kind: NODE_KINDS[node.kind].label,
			placement: PLACEMENT_LABELS[node.placement],
			zone: zoneOf.get(node.zone)?.label ?? node.zone,
			zoneKind: zoneOf.get(node.zone)?.kind ?? 'application',
			errors: count(`nodes/${node.id}`, 'error'),
			warnings: count(`nodes/${node.id}`, 'warning'),
		},
	})),
);

const nodeZone = $derived(new Map(model.nodes.map((node) => [node.id, node.zone])));

const edges = $derived<Edge[]>(
	model.connections.map((connection) => {
		const crossing = nodeZone.get(connection.from) !== nodeZone.get(connection.to);
		const flagged = findings.some(
			(entry) => entry.subject === `connections/${connection.id}` && entry.severity === 'error',
		);
		return {
			id: connection.id,
			source: connection.from,
			target: connection.to,
			label: crossing ? `${connection.protocol} ⇄` : connection.protocol,
			animated: connection.mode === 'async',
			style: [crossing ? 'stroke-dasharray: 6 4' : '', flagged ? 'stroke: var(--color-error)' : '']
				.filter(Boolean)
				.join(';'),
		};
	}),
);
</script>

<div class="canvas">
	{#if nodeTypes}
		<FlowDiagram
			{nodes}
			{edges}
			{nodeTypes}
			nodesConnectable
			selectedId={selectedId}
			{onselect}
			onconnect={({ source, target }) => onconnect(source, target)}
			onnodedragstop={onmove}
			height="min(70vh, 640px)"
			fitKey={model.id}
			ariaLabel={m.studio_design_canvas_aria()}
		/>
	{/if}
	<p class="legend">{m.studio_design_canvas_legend()}</p>
</div>

<style>
	.canvas {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		min-width: 0;
	}

	.legend {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
</style>
