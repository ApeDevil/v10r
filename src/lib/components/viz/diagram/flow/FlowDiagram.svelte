<script lang="ts">
import type { Edge, Node, NodeTypes } from '@xyflow/svelte';
import type { Component } from 'svelte';
import { onMount } from 'svelte';
import { cn } from '$lib/utils/cn';
import { type ChartContainerVariants, chartContainerVariants } from '../../_shared/chart-container';

interface Props {
	nodes: Node[];
	edges: Edge[];
	nodeTypes?: NodeTypes;
	fitView?: boolean;
	nodesDraggable?: boolean;
	nodesConnectable?: boolean;
	aspect?: ChartContainerVariants['aspect'];
	ariaLabel?: string;
	class?: string;
}

let {
	nodes: nodesProp,
	edges: edgesProp,
	nodeTypes: nodeTypesProp,
	fitView = true,
	nodesDraggable = true,
	nodesConnectable = false,
	aspect = 'auto',
	ariaLabel = 'Flow diagram',
	class: className,
}: Props = $props();

let internalNodes = $state.raw<Node[]>([]);
let internalEdges = $state.raw<Edge[]>([]);
let ready = $state(false);

// Dynamically loaded components (avoid SSR import of @xyflow/svelte)
let SvelteFlow: Component<any> | undefined = $state();
let Background: Component<any> | undefined = $state();
let Controls: Component<any> | undefined = $state();
let mergedNodeTypes = $state<NodeTypes>({});

$effect(() => {
	internalNodes = nodesProp;
});
$effect(() => {
	internalEdges = edgesProp;
});

onMount(async () => {
	const [xyflow, flowNodeModule] = await Promise.all([import('@xyflow/svelte'), import('./FlowNode.svelte')]);
	await import('@xyflow/svelte/dist/style.css');

	SvelteFlow = xyflow.SvelteFlow;
	Background = xyflow.Background;
	Controls = xyflow.Controls;

	const defaultNodeTypes = { flow: flowNodeModule.default } as NodeTypes;
	mergedNodeTypes = nodeTypesProp ? { ...defaultNodeTypes, ...nodeTypesProp } : defaultNodeTypes;

	ready = true;
});
</script>

<figure class={cn(chartContainerVariants({ aspect }), 'diagram-container', className)}>
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
		<div class="flow-wrapper visible">
			<SvelteFlow
				nodes={internalNodes}
				edges={internalEdges}
				nodeTypes={mergedNodeTypes}
				{fitView}
				{nodesDraggable}
				{nodesConnectable}
				proOptions={{ hideAttribution: true }}
			>
				<Background />
				<Controls />
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
</style>
