<script lang="ts">
import { PaneResizer } from 'paneforge';
import { cn } from '$lib/utils/cn';

interface Props {
	withHandle?: boolean;
	disabled?: boolean;
	onDraggingChange?: (isDragging: boolean) => void;
	class?: string;
}

let { withHandle = false, disabled, onDraggingChange, class: className }: Props = $props();
</script>

<PaneResizer
	{disabled}
	{onDraggingChange}
	class={cn(
		'resizable-handle',
		'relative shrink-0 select-none',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
		withHandle && 'with-grip',
		className
	)}
>
	{#if withHandle}
		<div class="grip-container">
			<span class="grip-dot"></span>
			<span class="grip-dot"></span>
			<span class="grip-dot"></span>
		</div>
	{/if}
</PaneResizer>

<style>
	/* Direction-dependent sizing via PaneForge data-direction attribute on resizer */
	:global([data-pane-resizer][data-direction='horizontal']) {
		width: 1px;
		height: 100%;
		cursor: col-resize;
	}

	:global([data-pane-resizer][data-direction='vertical']) {
		height: 1px;
		width: 100%;
		cursor: row-resize;
	}

	/* Wider hit target when grip indicator is shown */
	:global([data-pane-resizer][data-direction='horizontal'].with-grip) {
		width: 3px;
	}

	:global([data-pane-resizer][data-direction='vertical'].with-grip) {
		height: 3px;
	}

	/* Grip dots */
	.grip-container {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	:global([data-direction='horizontal']) .grip-container {
		flex-direction: column;
		gap: 2px;
	}

	:global([data-direction='vertical']) .grip-container {
		flex-direction: row;
		gap: 2px;
	}

	.grip-dot {
		display: block;
		width: 2px;
		height: 2px;
		border-radius: 9999px;
		background: color-mix(in srgb, var(--color-fg) 40%, transparent);
	}

	/* Hover/active states using color-mix (opacity modifiers broken with CSS vars) */
	:global(.resizable-handle) {
		background: color-mix(in srgb, var(--color-fg) 20%, transparent);
		transition: background-color 150ms;
	}

	:global(.resizable-handle:hover) {
		background: color-mix(in srgb, var(--color-primary) 50%, transparent);
	}

	:global(.resizable-handle:active),
	:global(.resizable-handle[data-dragging]) {
		background: var(--color-primary);
	}
</style>
