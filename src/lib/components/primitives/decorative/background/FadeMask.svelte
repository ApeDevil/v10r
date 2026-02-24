<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		edges?: ('top' | 'bottom' | 'left' | 'right')[];
		size?: number;
		class?: string;
		children: Snippet;
	}

	let {
		edges = ['bottom'],
		size = 48,
		class: className,
		children
	}: Props = $props();

	const edgeGradients: Record<string, (px: number) => string> = {
		top: (px) => `linear-gradient(to bottom, transparent, black ${px}px)`,
		bottom: (px) => `linear-gradient(to top, transparent, black ${px}px)`,
		left: (px) => `linear-gradient(to right, transparent, black ${px}px)`,
		right: (px) => `linear-gradient(to left, transparent, black ${px}px)`
	};

	let maskStyle = $derived.by(() => {
		const gradients = edges.map((edge) => edgeGradients[edge](size));
		const mask = gradients.join(', ');
		const isMulti = gradients.length > 1;
		return {
			mask,
			composite: isMulti ? 'intersect' : undefined,
			webkitComposite: isMulti ? 'source-in' : undefined
		};
	});
</script>

<div
	class={cn('fade-mask', className)}
	style:mask-image={maskStyle.mask}
	style:-webkit-mask-image={maskStyle.mask}
	style:mask-composite={maskStyle.composite}
	style:-webkit-mask-composite={maskStyle.webkitComposite}
>
	{@render children()}
</div>

<style>
	@media (forced-colors: active) {
		.fade-mask {
			mask-image: none !important;
			-webkit-mask-image: none !important;
		}
	}
</style>
