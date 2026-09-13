<script lang="ts">
import { BaseEdge, type Edge, type EdgeProps } from '@xyflow/svelte';
import type { TurnGraphEdgeKind } from '$lib/showcases/ai/turn-graph';
import { type EdgeRoute, orthogonalPath, routePoints } from '$lib/showcases/ai/turn-graph-layout';

// One edge of the turn graph, drawn along the route the layout gave it (a gutter track, the
// column's rail, a detour beneath the columns) so it never crosses a card. Its kind decides
// the stroke — data flow solid with an arrowhead, citations dotted — and a merged count sits
// on the leg entering the target. Only an edge the turn is still streaming through moves,
// and not for a reader who asked for reduced motion.
interface TurnGraphEdgeData extends Record<string, unknown> {
	kind: TurnGraphEdgeKind;
	route: EdgeRoute;
	highlight: boolean;
	dimmed: boolean;
	active: boolean;
	merged?: number;
}

let { id, sourceX, sourceY, targetX, targetY, markerEnd, data }: EdgeProps<Edge<TurnGraphEdgeData>> = $props();

const points = $derived(routePoints({ x: sourceX, y: sourceY }, data?.route.via ?? [], { x: targetX, y: targetY }));
const path = $derived(orthogonalPath(points));
const kind = $derived(data?.kind ?? 'request');
const label = $derived(
	data?.merged && data.merged > 1 && data.route.labelAt === 'entry' ? `×${data.merged}` : undefined,
);
// The entering leg: from the last bend to the target.
const entry = $derived(points.length >= 2 ? points[points.length - 2] : { x: targetX, y: targetY });
</script>

<BaseEdge
	{id}
	{path}
	{markerEnd}
	{label}
	labelX={(entry.x + targetX) / 2}
	labelY={targetY - 9}
	class="turn-edge turn-edge-{kind} {data?.highlight ? 'highlight' : ''} {data?.dimmed ? 'dimmed' : ''} {data?.active ? 'active' : ''}"
/>

<style>
	:global(.svelte-flow__edge-path.turn-edge) {
		stroke: var(--color-border);
		stroke-width: 1.5;
		transition:
			stroke var(--duration-fast),
			opacity var(--duration-fast);
	}

	:global(.svelte-flow__edge-path.turn-edge-citation) {
		stroke-dasharray: 1.5 3.5;
		stroke-linecap: round;
		stroke: var(--color-primary);
	}

	:global(.svelte-flow__edge-path.turn-edge-execution),
	:global(.svelte-flow__edge-path.turn-edge-result) {
		stroke: var(--color-fg);
	}

	:global(.svelte-flow__edge-path.turn-edge.highlight) {
		stroke: var(--color-primary);
		stroke-width: 2.5;
	}

	:global(.svelte-flow__edge-path.turn-edge.dimmed) {
		opacity: 0.25;
	}

	:global(.svelte-flow__edge-path.turn-edge.active) {
		stroke: var(--color-primary);
		stroke-dasharray: 6 4;
		animation: turn-edge-flow 1s linear infinite;
	}

	@keyframes turn-edge-flow {
		to {
			stroke-dashoffset: -20;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.svelte-flow__edge-path.turn-edge.active) {
			animation: none;
		}

		:global(.svelte-flow__edge-path.turn-edge) {
			transition: none;
		}
	}
</style>
