<script lang="ts">
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';
import { type BadgeVariants, badgeVariants } from './badge';

interface Props extends BadgeVariants {
	children: Snippet;
	class?: string;
}

let { children, variant = 'default', class: className }: Props = $props();
</script>

<span class={cn(badgeVariants({ variant }), className)}>
	{@render children()}
</span>

<style>
	span:global(.bg-primary) {
		background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
		color: var(--color-primary);
	}

	span:global(.bg-muted) {
		background-color: color-mix(in srgb, var(--color-muted) 20%, transparent);
	}

	span:global(.bg-success) {
		background-color: color-mix(in srgb, var(--color-success) 10%, transparent);
		color: var(--color-success);
	}

	span:global(.bg-warning) {
		background-color: color-mix(in srgb, var(--color-warning) 10%, transparent);
		color: var(--color-warning);
	}

	span:global(.bg-error) {
		background-color: color-mix(in srgb, var(--color-error) 10%, transparent);
		color: var(--color-error);
	}
</style>
