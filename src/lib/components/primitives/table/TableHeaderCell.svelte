<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { cn } from '$lib/utils/cn';

interface Props extends HTMLAttributes<HTMLTableCellElement> {
	children?: Snippet;
	class?: string;
}

let { children, class: className, ...rest }: Props = $props();
</script>

<th
	class={cn(
		'h-12 px-4 text-left align-middle font-medium text-muted',
		'[&:has([role=checkbox])]:pr-0',
		className
	)}
	{...rest}
>
	{#if children}{@render children()}{/if}
</th>
