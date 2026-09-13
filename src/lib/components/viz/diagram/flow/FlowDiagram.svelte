<script lang="ts">
import type { DefaultEdgeOptions, Edge, EdgeTypes, FitViewOptions, Node, NodeTypes } from '@xyflow/svelte';
import type { Component } from 'svelte';
import { onMount } from 'svelte';
import { cn } from '$lib/utils/cn';
import { type ChartContainerVariants, chartContainerVariants } from '../../_shared/chart-container';

interface Props {
	nodes: Node[];
	edges: Edge[];
	nodeTypes?: NodeTypes;
	edgeTypes?: EdgeTypes;
	fitView?: boolean;
	fitViewOptions?: FitViewOptions;
	nodesDraggable?: boolean;
	nodesConnectable?: boolean;
	/** Reader settings — the defaults are Svelte Flow's own, so a diagram is unchanged unless it asks. */
	elementsSelectable?: boolean;
	nodesFocusable?: boolean;
	preventScrolling?: boolean;
	zoomOnScroll?: boolean;
	panOnScroll?: boolean;
	zoomOnDoubleClick?: boolean;
	minZoom?: number;
	maxZoom?: number;
	defaultEdgeOptions?: DefaultEdgeOptions;
	/**
	 * Controlled selection: when defined, the `selected` flag of every node follows it and
	 * the flow's own selection is switched off — a click, Enter/Space on a focused node,
	 * Escape and a click on the pane report through `onselect`. A node with
	 * `selectable: false` stays a bystander.
	 */
	selectedId?: string | null;
	onselect?: (id: string | null) => void;
	/** A CSS height (`min(60vh, 640px)`, `32rem`, a number of px); absent keeps the 400px rule. */
	height?: number | string;
	/** Refit the viewport whenever this changes (a structural change: nodes added, the canvas resized). */
	fitKey?: unknown;
	/** The flow's controls, or which of their buttons to show (`showZoom`, `showFitView`, `showLock`); `false` hides them. */
	controls?: boolean | { showZoom?: boolean; showFitView?: boolean; showLock?: boolean };
	background?: boolean;
	aspect?: ChartContainerVariants['aspect'];
	ariaLabel?: string;
	class?: string;
}

let {
	nodes: nodesProp,
	edges: edgesProp,
	nodeTypes: nodeTypesProp,
	edgeTypes,
	fitView = true,
	fitViewOptions,
	nodesDraggable = true,
	nodesConnectable = false,
	elementsSelectable = true,
	nodesFocusable = true,
	preventScrolling = true,
	zoomOnScroll = true,
	panOnScroll = false,
	zoomOnDoubleClick = true,
	minZoom = 0.5,
	maxZoom = 2,
	defaultEdgeOptions,
	selectedId,
	onselect,
	height,
	fitKey,
	controls = true,
	background = true,
	aspect = 'auto',
	ariaLabel = 'Flow diagram',
	class: className,
}: Props = $props();

let internalNodes = $state.raw<Node[]>([]);
let internalEdges = $state.raw<Edge[]>([]);
let ready = $state(false);

const controlled = $derived(selectedId !== undefined);
const heightStyle = $derived(height === undefined ? undefined : typeof height === 'number' ? `${height}px` : height);

// Controlled selection reads the gestures itself and never lets the flow's store select:
// its selection-change signal keeps bookkeeping between evaluations and echoed a node the
// parent had just cleared back as selected. The gestures are the ones the flow would read —
// a click, Enter/Space on a focused node, Escape, a click on the pane (`onnodeclick` never
// fires for the keyboard, so the key handler reads the node element's own id).
const selectableIds = $derived(new Set(nodesProp.filter((n) => n.selectable !== false).map((n) => n.id)));

function report(id: string | null) {
	if (id !== selectedId) onselect?.(id);
}

function onNodeClick({ node }: { node: Node }) {
	if (controlled && selectableIds.has(node.id)) report(node.id);
}

function onPaneClick() {
	if (controlled) report(null);
}

function onKeyDown(event: KeyboardEvent) {
	if (!controlled) return;
	if (event.key === 'Escape') {
		report(null);
		return;
	}
	if (event.key !== 'Enter' && event.key !== ' ') return;
	const target = event.target as HTMLElement;
	if (target.closest('button, a, input, textarea, select, [contenteditable]')) return;
	const id = target.closest<HTMLElement>('.svelte-flow__node')?.dataset.id;
	if (!id || !selectableIds.has(id)) return;
	event.preventDefault();
	report(id);
}

// Dynamically loaded components (avoid SSR import of @xyflow/svelte)
let SvelteFlow: Component<Record<string, unknown>> | undefined = $state();
let Background: Component<Record<string, unknown>> | undefined = $state();
let Controls: Component<Record<string, unknown>> | undefined = $state();
let FlowFit: Component<{ fitKey: unknown; options?: FitViewOptions }> | undefined = $state();
let mergedNodeTypes = $state<NodeTypes>({});

$effect(() => {
	internalNodes = controlled
		? nodesProp.map((n) => ({
				...n,
				selected: n.id === selectedId,
				selectable: false,
				class: cn(n.class, selectableIds.has(n.id) && 'flow-selectable'),
			}))
		: nodesProp;
});
$effect(() => {
	internalEdges = edgesProp;
});

onMount(async () => {
	const [xyflow, flowNodeModule, flowFitModule] = await Promise.all([
		import('@xyflow/svelte'),
		import('./FlowNode.svelte'),
		import('./FlowFit.svelte'),
	]);
	await import('@xyflow/svelte/dist/style.css');

	SvelteFlow = xyflow.SvelteFlow;
	Background = xyflow.Background;
	Controls = xyflow.Controls;
	FlowFit = flowFitModule.default;

	const defaultNodeTypes = { flow: flowNodeModule.default } as NodeTypes;
	mergedNodeTypes = nodeTypesProp ? { ...defaultNodeTypes, ...nodeTypesProp } : defaultNodeTypes;

	ready = true;
});
</script>

<figure class={cn(chartContainerVariants({ aspect }), 'diagram-container', className)} style:height={heightStyle}>
	<figcaption class="sr-only">{ariaLabel}</figcaption>

	{#if !ready || !SvelteFlow || !Background || !Controls}
		<div class="skeleton" role="status">
			<svg viewBox="0 0 400 300" class="skeleton-svg" aria-hidden="true">
				<rect x="150" y="20" width="100" height="40" rx="6" class="skeleton-node pulse-1" />
				<line x1="200" y1="60" x2="200" y2="100" class="skeleton-edge" />
				<rect x="150" y="100" width="100" height="40" rx="6" class="skeleton-node pulse-2" />
				<line x1="200" y1="140" x2="120" y2="180" class="skeleton-edge" />
				<line x1="200" y1="140" x2="280" y2="180" class="skeleton-edge" />
				<rect x="70" y="180" width="100" height="40" rx="6" class="skeleton-node pulse-3" />
				<rect x="230" y="180" width="100" height="40" rx="6" class="skeleton-node pulse-4" />
				<line x1="120" y1="220" x2="200" y2="260" class="skeleton-edge" />
				<line x1="280" y1="220" x2="200" y2="260" class="skeleton-edge" />
				<rect x="150" y="250" width="100" height="40" rx="6" class="skeleton-node pulse-1" />
			</svg>
			<span class="sr-only">Loading flow diagram</span>
		</div>
	{:else}
		<div class="flow-wrapper visible" class:controlled>
			<SvelteFlow
				nodes={internalNodes}
				edges={internalEdges}
				nodeTypes={mergedNodeTypes}
				{edgeTypes}
				{fitView}
				{fitViewOptions}
				{nodesDraggable}
				{nodesConnectable}
				elementsSelectable={controlled ? false : elementsSelectable}
				{nodesFocusable}
				{preventScrolling}
				{zoomOnScroll}
				{panOnScroll}
				{zoomOnDoubleClick}
				{minZoom}
				{maxZoom}
				{defaultEdgeOptions}
				selectionKey={controlled ? null : undefined}
				multiSelectionKey={controlled ? null : undefined}
				deleteKey={controlled ? null : undefined}
				onnodeclick={controlled ? onNodeClick : undefined}
				onpaneclick={controlled ? onPaneClick : undefined}
				onkeydown={controlled ? onKeyDown : undefined}
				proOptions={{ hideAttribution: true }}
			>
				{#if background}
					<Background />
				{/if}
				{#if controls}
					<Controls {...(typeof controls === 'object' ? controls : {})} />
				{/if}
				{#if fitKey !== undefined && FlowFit}
					<FlowFit {fitKey} options={fitViewOptions} />
				{/if}
			</SvelteFlow>
		</div>
	{/if}
</figure>

<style>
	.diagram-container {
		overflow: hidden;
		position: relative;
		height: 400px;
	}

	.skeleton {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.skeleton-svg {
		width: 100%;
		height: 100%;
		max-height: 300px;
	}

	.skeleton-edge {
		stroke: var(--chart-grid);
		stroke-width: 1.5;
	}

	.skeleton-node {
		fill: var(--chart-grid);
	}

	.pulse-1 { animation: pulse 1.5s ease-in-out infinite; }
	.pulse-2 { animation: pulse 1.5s ease-in-out 0.15s infinite; }
	.pulse-3 { animation: pulse 1.5s ease-in-out 0.3s infinite; }
	.pulse-4 { animation: pulse 1.5s ease-in-out 0.45s infinite; }

	@keyframes pulse {
		0%, 100% { opacity: 0.3; }
		50% { opacity: 0.6; }
	}

	.flow-wrapper {
		width: 100%;
		height: 100%;
		opacity: 0;
		transition: opacity 0.15s ease-in;
	}

	.flow-wrapper.visible {
		opacity: 1;
	}

	/* Svelte Flow theme overrides using design tokens */
	.flow-wrapper :global(.svelte-flow) {
		--xy-background-color: var(--surface-1);
		--xy-node-border-radius: var(--radius-md);
		--xy-node-color: var(--color-fg);
		--xy-edge-stroke: var(--color-border);
		--xy-edge-stroke-width: 1.5;
		--xy-edge-stroke-selected: var(--color-primary);
		--xy-handle-background-color: var(--color-primary);
		--xy-handle-border-color: var(--surface-1);
		--xy-connectionline-stroke: var(--color-primary);
		--xy-attribution-background-color: transparent;
	}

	.flow-wrapper :global(.svelte-flow__background) {
		--xy-background-pattern-color: var(--chart-grid);
	}

	.flow-wrapper :global(.svelte-flow__controls) {
		box-shadow: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.flow-wrapper :global(.svelte-flow__controls-button) {
		background: var(--surface-1);
		border-bottom: 1px solid var(--color-border);
		fill: var(--color-muted);
		width: 28px;
		height: 28px;
	}

	.flow-wrapper :global(.svelte-flow__controls-button:hover) {
		background: var(--color-subtle);
		fill: var(--color-fg);
	}

	.flow-wrapper :global(.svelte-flow__edge-path) {
		stroke: var(--color-border);
	}

	.flow-wrapper :global(.svelte-flow__edge.selected .svelte-flow__edge-path) {
		stroke: var(--color-primary);
	}

	.flow-wrapper :global(.svelte-flow__edge-text) {
		font-size: 11px;
	}

	.flow-wrapper :global(.svelte-flow__edge-textbg) {
		fill: var(--surface-1);
	}

	.flow-wrapper :global(.svelte-flow__handle) {
		width: 8px;
		height: 8px;
	}

	/* The flow marks its own selectable nodes; controlled ones are marked by the wrapper. */
	.flow-wrapper.controlled :global(.svelte-flow__node.flow-selectable) {
		cursor: pointer;
	}
</style>
