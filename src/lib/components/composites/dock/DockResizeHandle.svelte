<script lang="ts">
import { cn } from '$lib/utils/cn';
import { getDockContext } from './dock.state.svelte';

interface Props {
	splitId: string;
	direction: 'horizontal' | 'vertical';
	sizes: [number, number];
	class?: string;
}

let { splitId, direction, sizes, class: className }: Props = $props();

const dock = getDockContext();
const MIN_SIZE = 10;

let dragging = $state(false);

// --- Pointer resize ---

function handlePointerDown(e: PointerEvent) {
	if (e.button !== 0) return;
	e.preventDefault();
	dragging = true;
	(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function handlePointerMove(e: PointerEvent) {
	if (!dragging) return;

	const handle = e.currentTarget as HTMLElement;
	const container = handle.parentElement;
	if (!container) return;

	const rect = container.getBoundingClientRect();
	let ratio: number;

	if (direction === 'horizontal') {
		ratio = ((e.clientX - rect.left) / rect.width) * 100;
	} else {
		ratio = ((e.clientY - rect.top) / rect.height) * 100;
	}

	const clamped = Math.max(MIN_SIZE, Math.min(100 - MIN_SIZE, ratio));
	dock.resizeSplit(splitId, [clamped, 100 - clamped]);
}

function handlePointerUp(_e: PointerEvent) {
	if (!dragging) return;
	dragging = false;
}

// --- Keyboard resize ---

function handleKeyDown(e: KeyboardEvent) {
	const step = e.shiftKey ? 10 : 2;
	let newFirst = sizes[0];

	if (direction === 'horizontal') {
		if (e.key === 'ArrowLeft') newFirst -= step;
		else if (e.key === 'ArrowRight') newFirst += step;
		else if (e.key === 'Home') newFirst = MIN_SIZE;
		else if (e.key === 'End') newFirst = 100 - MIN_SIZE;
		else return;
	} else {
		if (e.key === 'ArrowUp') newFirst -= step;
		else if (e.key === 'ArrowDown') newFirst += step;
		else if (e.key === 'Home') newFirst = MIN_SIZE;
		else if (e.key === 'End') newFirst = 100 - MIN_SIZE;
		else return;
	}

	e.preventDefault();
	const clamped = Math.max(MIN_SIZE, Math.min(100 - MIN_SIZE, newFirst));
	dock.resizeSplit(splitId, [clamped, 100 - clamped]);
}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class={cn('dock-resize-handle', className)}
	data-direction={direction}
	data-dragging={dragging || undefined}
	role="separator"
	tabindex="0"
	aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
	aria-valuenow={Math.round(sizes[0])}
	aria-valuemin={MIN_SIZE}
	aria-valuemax={100 - MIN_SIZE}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	onlostpointercapture={() => (dragging = false)}
	onkeydown={handleKeyDown}
>
	<div class="dock-resizer-line"></div>
</div>

<style>
	.dock-resize-handle {
		position: relative;
		flex-shrink: 0;
		user-select: none;
		touch-action: none;
		z-index: 1;
	}

	.dock-resize-handle[data-direction='horizontal'] {
		width: 6px;
		cursor: col-resize;
	}

	.dock-resize-handle[data-direction='vertical'] {
		height: 6px;
		cursor: row-resize;
	}

	.dock-resize-handle:focus-visible {
		outline: none;
	}

	.dock-resize-handle:focus-visible .dock-resizer-line {
		background: var(--color-primary);
	}

	.dock-resizer-line {
		position: absolute;
		background: var(--desk-shell-border, var(--color-border));
		pointer-events: none;
		transition: background-color 150ms;
	}

	[data-direction='horizontal'] .dock-resizer-line {
		top: 0;
		bottom: 0;
		left: 50%;
		width: 1px;
		transform: translateX(-50%);
	}

	[data-direction='vertical'] .dock-resizer-line {
		left: 0;
		right: 0;
		top: 50%;
		height: 2px;
		transform: translateY(-50%);
	}

	.dock-resize-handle:hover .dock-resizer-line {
		background: color-mix(in srgb, var(--color-primary) 50%, transparent);
	}

	.dock-resize-handle:active .dock-resizer-line,
	.dock-resize-handle[data-dragging] .dock-resizer-line {
		background: var(--color-primary);
	}
</style>
