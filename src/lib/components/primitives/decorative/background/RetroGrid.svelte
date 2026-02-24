<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		perspective?: number;
		color?: string;
		opacity?: number;
		animated?: boolean;
		class?: string;
		children?: Snippet;
	}

	let {
		perspective = 300,
		color = 'currentColor',
		opacity = 0.15,
		animated = false,
		class: className,
		children
	}: Props = $props();
</script>

<div class={cn('relative overflow-hidden', className)}>
	<div
		class="retro-grid"
		class:animated
		style:--grid-color={color}
		style:--grid-opacity={String(opacity)}
		style:--grid-perspective="{perspective}px"
		aria-hidden="true"
	></div>

	{#if children}
		<div class="relative z-1">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.retro-grid {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background-image:
			linear-gradient(to right, var(--grid-color) 1px, transparent 1px),
			linear-gradient(to bottom, var(--grid-color) 1px, transparent 1px);
		background-size: 40px 40px;
		opacity: var(--grid-opacity);
		transform-origin: center top;
		transform: perspective(var(--grid-perspective)) rotateX(60deg);
		mask-image: linear-gradient(to bottom, black 30%, transparent 95%);
		-webkit-mask-image: linear-gradient(to bottom, black 30%, transparent 95%);
	}

	.retro-grid.animated {
		animation: retro-scroll 20s linear infinite;
	}

	@keyframes retro-scroll {
		from {
			background-position: 0 0;
		}
		to {
			background-position: 0 40px;
		}
	}

	@media (forced-colors: active) {
		.retro-grid {
			display: none;
		}
	}
</style>
