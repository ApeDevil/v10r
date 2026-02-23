<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** X position as percentage of container (0–100) */
		x: number;
		/** Y position as percentage of container (0–100) */
		y: number;
		/** Whether to show the tooltip */
		visible: boolean;
		/** Where to place relative to anchor. Default: 'top' */
		placement?: 'top' | 'bottom' | 'left' | 'right';
		/** Slotted content */
		children: Snippet;
	}

	let { x, y, visible, placement = 'top', children }: Props = $props();

	const transforms: Record<string, string> = {
		top: 'translate(-50%, calc(-100% - 12px))',
		bottom: 'translate(-50%, 12px)',
		left: 'translate(calc(-100% - 12px), -50%)',
		right: 'translate(12px, -50%)',
	};
</script>

{#if visible}
	<div
		class="svg-tooltip svg-tooltip-{placement}"
		style="left: {x}%; top: {y}%; transform: {transforms[placement]};"
		role="tooltip"
	>
		{@render children()}
	</div>
{/if}

<style>
	.svg-tooltip {
		position: absolute;
		pointer-events: none;
		white-space: nowrap;
		padding: 4px 8px;
		border-radius: var(--radius-md);
		background-color: var(--color-surface-3);
		border: 1px solid var(--color-border);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--color-fg) 8%, transparent);
		display: flex;
		flex-direction: column;
		gap: 1px;
		z-index: 10;
		opacity: 1;
	}

	.svg-tooltip-top {
		animation: tooltip-top 120ms ease-out;
	}

	.svg-tooltip-bottom {
		animation: tooltip-bottom 120ms ease-out;
	}

	.svg-tooltip-left {
		animation: tooltip-left 120ms ease-out;
	}

	.svg-tooltip-right {
		animation: tooltip-right 120ms ease-out;
	}

	@keyframes tooltip-top {
		from {
			opacity: 0;
			transform: translate(-50%, calc(-100% - 8px));
		}
		to {
			opacity: 1;
			transform: translate(-50%, calc(-100% - 12px));
		}
	}

	@keyframes tooltip-bottom {
		from {
			opacity: 0;
			transform: translate(-50%, 8px);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 12px);
		}
	}

	@keyframes tooltip-left {
		from {
			opacity: 0;
			transform: translate(calc(-100% - 8px), -50%);
		}
		to {
			opacity: 1;
			transform: translate(calc(-100% - 12px), -50%);
		}
	}

	@keyframes tooltip-right {
		from {
			opacity: 0;
			transform: translate(8px, -50%);
		}
		to {
			opacity: 1;
			transform: translate(12px, -50%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.svg-tooltip-top,
		.svg-tooltip-bottom,
		.svg-tooltip-left,
		.svg-tooltip-right {
			animation: none;
		}
	}
</style>
