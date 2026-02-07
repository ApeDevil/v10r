<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { carouselItemVariants, type CarouselItemVariants } from './carousel';
	import type { Snippet } from 'svelte';

	interface Props extends CarouselItemVariants {
		children: Snippet;
		class?: string;
	}

	let { children, orientation = 'horizontal', class: className }: Props = $props();
</script>

<div class={cn(carouselItemVariants({ orientation }), className)} role="listitem">
	{@render children()}
</div>
