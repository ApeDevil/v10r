<script lang="ts">
import type { Edge, Node, NodeTypes } from '@xyflow/svelte';
import type { Component } from 'svelte';
import { onMount } from 'svelte';
import { cn } from '$lib/utils/cn';
import { type ChartContainerVariants, chartContainerVariants } from '../../_shared/chart-container';

interface Props {
	nodes: Node[];
	edges: Edge[];
	aspect?: ChartContainerVariants['aspect'];
	ariaLabel?: string;
	class?: string;
}

let {
	nodes: nodesProp,
	edges: edgesProp,
	aspect = 'auto',
	ariaLabel = 'State diagram',
	class: className,
}: Props = $props();

let internalNodes = $state.raw<Node[]>([]);
let internalEdges = $state.raw<Edge[]>([]);
let ready = $state(false);

// Dynamically loaded components (avoid SSR import of @xyflow/svelte)
let SvelteFlow: Component<Record<string, unknown>> | undefined = $state();
let Background: Component<Record<string, unknown>> | undefined = $state();
let Controls: Component<Record<string, unknown>> | undefined = $state();
let nodeTypes = $state<NodeTypes>({});

$effect(() => {
	internalNodes = nodesProp;
});
$effect(() => {
	internalEdges = edgesProp;
});

onMount(async () => {
	const [xyflow, stateNodeModule] = await Promise.all([import('@xyflow/svelte'), import('./StateNode.svelte')]);
	await import('@xyflow/svelte/dist/style.css');

	SvelteFlow = xyflow.SvelteFlow;
	Background = xyflow.Background;
	Controls = xyflow.Controls;

	nodeTypes = {
		state: stateNodeModule.default,
		start: stateNodeModule.default,
		end: stateNodeModule.default,
	} as NodeTypes;

	ready = true;
});
</script>

<figure class={cn(chartContainerVariants({ aspect }), 'diagram-container', className)}>
	<figcaption class="sr-only">{ariaLabel}</figcaption>

	{#if !ready || !SvelteFlow || !Background || !Controls}
		<div class="skeleton" role="status">
			<svg viewBox="0 0 400 200" class="skeleton-svg" aria-hidden="true">
				<circle cx="30" cy="100" r="10" class="skeleton-node-solid pulse-1" />
				<line x1="40" y1="100" x2="80" y2="100" class="skeleton-edge" />
				<rect x="80" y="80" width="80" height="40" rx="20" class="skeleton-node pulse-2" />
				<line x1="160" y1="100" x2="200" y2="100" class="skeleton-edge" />
				<rect x="200" y="80" width="80" height="40" rx="20" class="skeleton-node pulse-3" />
				<line x1="280" y1="100" x2="320" y2="100" class="skeleton-edge" />
				<circle cx="340" cy="100" r="12" class="skeleton-node pulse-4" />
				<circle cx="340" cy="100" r="7" class="skeleton-node-solid pulse-4" />
			</svg>
			<span class="sr-only">Loading state diagram</span>
		</div>
	{:else}
		<div class="flow-wrapper visible">
			<SvelteFlow
				nodes={internalNodes}
				edges={internalEdges}
				{nodeTypes}
				fitView
				nodesDraggable={false}
				nodesConnectable={false}
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
		max-height: 200px;
	}

	.skeleton-edge {
		stroke: var(--chart-grid);
		stroke-width: 1.5;
	}

	.skeleton-node {
		fill: none;
		stroke: var(--chart-grid);
		stroke-width: 2;
	}

	.skeleton-node-solid {
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
		--xy-node-border-radius: 999px;
		--xy-node-color: var(--color-fg);
		--xy-edge-stroke: var(--color-border);
		--xy-edge-stroke-width: 2;
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

	.flow-wrapper :global(.svelte-flow__edge.animated .svelte-flow__edge-path) {
		stroke-dasharray: 5;
		animation: dash 0.5s linear infinite;
	}

	@keyframes dash {
		to {
			stroke-dashoffset: -10;
		}
	}

	.flow-wrapper :global(.svelte-flow__edgelabel-renderer) {
		font-size: 11px;
		color: var(--color-muted);
	}

	.flow-wrapper :global(.svelte-flow__edge-text) {
		font-size: 11px;
	}

	.flow-wrapper :global(.svelte-flow__edge-textbg) {
		fill: var(--surface-1);
	}

	.flow-wrapper :global(.svelte-flow__handle) {
		width: 6px;
		height: 6px;
		opacity: 0;
	}
</style>
