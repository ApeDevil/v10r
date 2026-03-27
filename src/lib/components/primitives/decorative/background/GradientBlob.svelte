<script lang="ts">
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';

interface Props {
	colors?: string[];
	blur?: number;
	animated?: boolean;
	opacity?: number;
	class?: string;
	children?: Snippet;
}

let {
	colors = ['var(--color-primary)', 'var(--color-success)', 'var(--color-warning)'],
	blur = 80,
	animated = false,
	opacity = 0.15,
	class: className,
	children,
}: Props = $props();
</script>

<div class={cn('relative overflow-hidden', className)}>
	<div
		class="blob-container"
		class:animated
		style:--blob-opacity={String(opacity)}
		style:--blob-blur="{blur}px"
		aria-hidden="true"
	>
		{#each colors as bg, i}
			<div class="blob blob-{i}" style:background={bg}></div>
		{/each}
	</div>

	{#if children}
		<div class="relative z-1">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.blob-container {
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: var(--blob-opacity);
		filter: blur(var(--blob-blur));
	}

	.blob {
		position: absolute;
		border-radius: 50%;
		width: 50%;
		height: 50%;
	}

	.blob-0 {
		top: 10%;
		left: 15%;
	}

	.blob-1 {
		top: 20%;
		right: 15%;
	}

	.blob-2 {
		bottom: 15%;
		left: 30%;
	}

	.blob-container.animated .blob {
		animation: blob-float 15s ease-in-out infinite;
	}

	.blob-container.animated .blob-1 {
		animation-delay: -5s;
		animation-direction: reverse;
	}

	.blob-container.animated .blob-2 {
		animation-delay: -10s;
	}

	@keyframes blob-float {
		0%, 100% {
			transform: translate(0, 0) scale(1);
		}
		33% {
			transform: translate(20px, -30px) scale(1.1);
		}
		66% {
			transform: translate(-15px, 20px) scale(0.9);
		}
	}

	@media (forced-colors: active) {
		.blob-container {
			display: none;
		}
	}
</style>
