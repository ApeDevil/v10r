<script lang="ts">
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';
import { type CarouselItemVariants, carouselItemVariants } from './carousel';

interface Props extends CarouselItemVariants {
	children: Snippet;
	class?: string;
}

let { children, orientation = 'horizontal', class: className }: Props = $props();
</script>

<div class={cn(carouselItemVariants({ orientation }), className)} role="listitem">
	{@render children()}
</div>
