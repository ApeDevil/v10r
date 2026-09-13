<script lang="ts">
import { type Edge, type FitViewOptions, MarkerType, type Node } from '@xyflow/svelte';
import { untrack } from 'svelte';
import { Button } from '$lib/components/primitives';
import FlowDiagram from '$lib/components/viz/diagram/flow/FlowDiagram.svelte';
import * as m from '$lib/paraglide/messages';
import { COLUMN_LABELS, KIND_LABELS } from '$lib/showcases/ai/labels';
import { connectedIds, type TurnGraph, visibleTurnGraph } from '$lib/showcases/ai/turn-graph';
import { cardVariant, layoutTurnGraph, routeEdges } from '$lib/showcases/ai/turn-graph-layout';
import TurnGraphEdge from './TurnGraphEdge.svelte';
import TurnGraphFlowNode from './TurnGraphFlowNode.svelte';
import TurnGraphGroupNode from './TurnGraphGroupNode.svelte';
import TurnGraphHeadingNode from './TurnGraphHeadingNode.svelte';

// The turn graph on a canvas (desktop): the pure projection laid out in three fixed columns
// — a node with visible members drawn as a group holding them — rendered by Svelte Flow
// through the shared wrapper along routes that never cross a card. Reading settings, not
// editing: nothing drags or connects, the wheel scrolls the page (Ctrl+wheel zooms).
// Expanding never refits: the canvas grows and the zoom stays readable; a detail opening
// beside the canvas refits to the highlighted subgraph, never below a readable floor; "Fit
// everything" is the reader's own action. Selection is the inspector's — a card, its tree
// row and its timeline bar are one record. This module imports `@xyflow/svelte` statically,
// so the inspector loads it lazily.
interface Props {
	graph: TurnGraph;
	/** Keyed by the turn: a new turn remounts the canvas. */
	turnKey: string;
	/** The detail pane is open beside the canvas — the canvas is narrower and refits to the selection. */
	detailOpen: boolean;
	expanded: ReadonlySet<string>;
	selectedId: string | null;
	callId: string | null;
	onselect: (id: string | null) => void;
	ontoggle: (id: string) => void;
}

let { graph, turnKey, detailOpen, expanded, selectedId, callId, onselect, ontoggle }: Props = $props();

const HEADING_HEIGHT = 36;
const DIMMED_KINDS = new Set(['prompt', 'block', 'history', 'call', 'tool']);
const READABLE_ZOOM = 0.8;
const FIT_PADDING = 0.06;

const visible = $derived(visibleTurnGraph(graph, expanded));
const layout = $derived(layoutTurnGraph(visible));
const routes = $derived(routeEdges(visible, layout));
const connected = $derived(connectedIds(visible, selectedId));
const byId = $derived(new Map(visible.nodes.map((n) => [n.id, n])));

const nodes = $derived.by((): Node[] => {
	const headings: Node[] = (['sources', 'context', 'tools'] as const).map((column) => ({
		id: `heading:${column}`,
		type: 'heading',
		position: { x: layout.columns[column].x, y: -HEADING_HEIGHT },
		width: layout.columns[column].width,
		height: HEADING_HEIGHT,
		measured: { width: layout.columns[column].width, height: HEADING_HEIGHT },
		data: { label: COLUMN_LABELS[column]() },
		selectable: false,
		focusable: false,
		draggable: false,
	}));
	// Placement order: a group before its members, whose positions are relative to it. Every
	// node carries its size as `measured` too: the flow only counts a node initialized once it
	// is measured, and a node object the parent replaced (any re-render) would otherwise wait
	// for a resize that never comes — leaving every queued fit unresolved.
	const cards: Node[] = layout.order.flatMap((id) => {
		const node = byId.get(id);
		if (!node) return [];
		const position = layout.positions.get(id) ?? { x: 0, y: 0 };
		const parent = node.parentId && layout.positions.has(node.parentId) ? node.parentId : undefined;
		const origin = parent ? (layout.positions.get(parent) ?? { x: 0, y: 0 }) : { x: 0, y: 0 };
		const size = layout.sizes.get(id) ?? { width: 260, height: 64 };
		const interactive = node.kind !== 'boundary';
		const dimmed =
			(selectedId !== null && !connected.nodes.has(id)) ||
			(callId !== null && DIMMED_KINDS.has(node.kind) && !node.flags.inCall);
		return [
			{
				id,
				type: layout.groups.has(id) ? 'group' : 'card',
				position: { x: position.x - origin.x, y: position.y - origin.y },
				...(parent ? { parentId: parent } : {}),
				width: size.width,
				height: size.height,
				measured: { width: size.width, height: size.height },
				data: {
					node,
					variant: cardVariant(node, layout.groups),
					connected: connected.nodes.has(id) && id !== selectedId,
					dimmed: interactive && dimmed,
					expanded: expanded.has(id),
					ontoggle,
				},
				selectable: interactive,
				focusable: interactive,
				draggable: false,
				ariaLabel: `${KIND_LABELS[node.kind]()} ${node.label}`,
			},
		];
	});
	return [...headings, ...cards];
});

const edges = $derived.by((): Edge[] =>
	visible.edges.flatMap((edge) => {
		const route = routes.get(edge.id);
		if (!route) return [];
		const highlight = connected.edges.has(edge.id);
		const dimmed =
			(selectedId !== null && !highlight) || (callId !== null && edge.kind !== 'containment' && !edge.inCall);
		const strong = edge.kind === 'execution' || edge.kind === 'result';
		const color =
			highlight || edge.active
				? 'var(--color-primary)'
				: edge.kind === 'citation'
					? 'var(--color-primary)'
					: strong
						? 'var(--color-fg)'
						: 'var(--color-border)';
		return [
			{
				id: edge.id,
				source: edge.source,
				target: edge.target,
				sourceHandle: route.sourceHandle,
				targetHandle: route.targetHandle,
				type: 'turn',
				selectable: false,
				focusable: false,
				data: { kind: edge.kind, route, highlight, dimmed, active: edge.active === true, merged: edge.merged },
				markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color },
				zIndex: highlight ? 1 : 0,
			},
		];
	}),
);

// The reader's explicit fit is the only one allowed below the readable floor; the mount
// fit counts as one. A detail opening or closing refits (the canvas changed width) to what is
// highlighted, never smaller than readable. Expanding a group refits nothing.
let fitRequest = $state(0);
let explicit = $state(true);
let mounted = false;
$effect(() => {
	void detailOpen;
	if (!mounted) {
		mounted = true;
		return;
	}
	untrack(() => {
		explicit = false;
	});
});
const fitKey = $derived(`${detailOpen}:${fitRequest}`);
const fitViewOptions = $derived.by((): FitViewOptions => {
	if (explicit) return { padding: FIT_PADDING, minZoom: 0.4, maxZoom: 1 };
	const focus = detailOpen && selectedId ? [...connected.nodes].filter((id) => byId.has(id)).map((id) => ({ id })) : [];
	return { padding: FIT_PADDING, minZoom: READABLE_ZOOM, maxZoom: 1, ...(focus.length > 0 ? { nodes: focus } : {}) };
});

function fitEverything() {
	explicit = true;
	fitRequest += 1;
}

// The canvas follows the graph: its own height plus the headings, the detour and the fit's
// padding, so a fit lands at zoom 1 — never a blank field below a short turn, never more
// than the viewport can show at once.
const height = $derived(
	`min(${Math.max(320, Math.ceil((layout.detourY + HEADING_HEIGHT) / (1 - 2 * FIT_PADDING)) + 8)}px, 88vh)`,
);
</script>

{#key turnKey}
	<div class="shell">
		<FlowDiagram
			{nodes}
			{edges}
			nodeTypes={{ card: TurnGraphFlowNode, group: TurnGraphGroupNode, heading: TurnGraphHeadingNode }}
			edgeTypes={{ turn: TurnGraphEdge }}
			{selectedId}
			{onselect}
			nodesDraggable={false}
			nodesConnectable={false}
			preventScrolling={false}
			zoomOnScroll={false}
			panOnScroll={false}
			zoomOnDoubleClick={false}
			minZoom={0.4}
			maxZoom={1.5}
			{fitViewOptions}
			{fitKey}
			{height}
			controls={{ showFitView: false, showLock: false }}
			ariaLabel={m.showcase_ai_graph_aria()}
			class="turn-graph-canvas"
		/>
		<div class="fit">
			<Button variant="secondary" size="sm" onclick={fitEverything}>
				<span class="i-lucide-maximize h-4 w-4" aria-hidden="true"></span>
				{m.showcase_ai_graph_fit_everything()}
			</Button>
		</div>
	</div>
{/key}

<style>
	.shell {
		position: relative;
	}

	.fit {
		position: absolute;
		top: var(--spacing-2);
		right: var(--spacing-2);
		z-index: 5;
	}
</style>
