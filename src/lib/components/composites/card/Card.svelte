<script lang="ts">
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';

interface Props {
	header?: Snippet;
	footer?: Snippet;
	children?: Snippet;
	class?: string;
}

let { header, footer, children, class: className }: Props = $props();
</script>

<article class={cn('rounded-lg border border-border bg-surface-1 shadow-sm', className)}>
	{#if header}
		<header class="flex flex-col gap-4 border-b border-border px-fluid-4 py-fluid-3">
			{@render header()}
		</header>
	{/if}

	{#if children}
		<div class="px-fluid-4 py-fluid-4">
			{@render children()}
		</div>
	{/if}

	{#if footer}
		<footer class="border-t border-border px-fluid-4 py-fluid-3">
			{@render footer()}
		</footer>
	{/if}
</article>
