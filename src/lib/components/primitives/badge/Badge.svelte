<script lang="ts">
	import type { Snippet } from 'svelte';
	import { badgeVariants, type BadgeVariants } from './badge';
	import { cn } from '$lib/utils/cn';

	interface Props extends BadgeVariants {
		children: Snippet;
		class?: string;
	}

	let { children, variant = 'default', class: className }: Props = $props();
</script>

<span class={cn(badgeVariants({ variant }), className)}>
	{@render children()}
</span>
