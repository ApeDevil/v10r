<script lang="ts">
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';
import { carouselItemVariants } from './carousel';

interface Props {
	children: Snippet;
	class?: string;
}

let { children, class: className }: Props = $props();
</script>

<div class={cn(carouselItemVariants(), className)} role="listitem">
	{@render children()}
</div>
