<script lang="ts">
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';

interface Props {
	color?: string;
	position?: 'center' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
	size?: 'sm' | 'md' | 'lg' | 'full';
	opacity?: number;
	class?: string;
	children?: Snippet;
}

let {
	color = 'var(--color-primary)',
	position = 'center',
	size = 'md',
	opacity = 0.15,
	class: className,
	children,
}: Props = $props();

const positionMap: Record<string, string> = {
	center: 'at center center',
	top: 'at center 0%',
	bottom: 'at center 100%',
	'top-left': 'at 0% 0%',
	'top-right': 'at 100% 0%',
	'bottom-left': 'at 0% 100%',
	'bottom-right': 'at 100% 100%',
};

const sizeMap: Record<string, string> = {
	sm: 'closest-side',
	md: 'farthest-corner',
	lg: 'farthest-side',
	full: 'farthest-corner',
};

let gradient = $derived(`radial-gradient(${sizeMap[size]} ${positionMap[position]}, ${color}, transparent)`);
</script>

<div class={cn('relative overflow-hidden', className)}>
	<div
		class="glow-layer"
		style:background={gradient}
		style:opacity={opacity}
		aria-hidden="true"
	></div>

	{#if children}
		<div class="relative z-1">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.glow-layer {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	@media (forced-colors: active) {
		.glow-layer {
			display: none;
		}
	}
</style>
