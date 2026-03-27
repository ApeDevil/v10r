<script lang="ts">
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';

interface Props {
	children: Snippet;
	class?: string;
}

let { children, class: className }: Props = $props();
</script>

<div class={cn('diag-grid', className)}>
	{@render children()}
</div>

<style>
	.diag-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}
</style>
