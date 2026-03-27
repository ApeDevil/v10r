<script lang="ts">
import { resolveDropZone } from './dock.operations';
import { getDockContext } from './dock.state.svelte';
import type { DropZone } from './dock.types';

interface Props {
	leafId: string;
}

let { leafId }: Props = $props();

const dock = getDockContext();

let overlayEl = $state<HTMLElement | null>(null);
let currentZone = $state<DropZone | null>(null);

function handlePointerMove(e: PointerEvent) {
	if (!dock.dragState || !overlayEl) return;
	// Don't show overlay when dragging within same leaf
	if (dock.dragState.sourceLeafId === leafId && currentZone === null) {
		// Allow it — user might want to drop on edge to split
	}

	const rect = overlayEl.getBoundingClientRect();
	const zone = resolveDropZone(rect, e.clientX, e.clientY);
	currentZone = zone;
	dock.updateDragTarget({ leafId, zone });
}

function handlePointerLeave() {
	if (!dock.dragState) return;
	currentZone = null;
	dock.updateDragTarget(null);
}

const isDragging = $derived(dock.dragState !== null);
const isTargeted = $derived(dock.dragState?.target?.leafId === leafId);
</script>

{#if isDragging}
	<div
		class="dock-drop-overlay"
		bind:this={overlayEl}
		onpointermove={handlePointerMove}
		onpointerleave={handlePointerLeave}
	>
		{#if isTargeted && currentZone}
			<div class="dock-drop-indicator {currentZone}"></div>
		{/if}
	</div>
{/if}

<style>
	.dock-drop-overlay {
		position: absolute;
		inset: 0;
		z-index: 10;
	}

	.dock-drop-indicator {
		position: absolute;
		background: color-mix(in srgb, var(--color-primary) 20%, transparent);
		border: 2px solid var(--color-primary);
		border-radius: var(--radius-sm);
		pointer-events: none;
		transition: all 100ms ease;
	}

	.dock-drop-indicator.center {
		inset: 4px;
	}

	.dock-drop-indicator.left {
		top: 4px;
		left: 4px;
		bottom: 4px;
		width: calc(50% - 8px);
	}

	.dock-drop-indicator.right {
		top: 4px;
		right: 4px;
		bottom: 4px;
		width: calc(50% - 8px);
	}

	.dock-drop-indicator.top {
		top: 4px;
		left: 4px;
		right: 4px;
		height: calc(50% - 8px);
	}

	.dock-drop-indicator.bottom {
		bottom: 4px;
		left: 4px;
		right: 4px;
		height: calc(50% - 8px);
	}
</style>
