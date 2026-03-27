<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { cn } from '$lib/utils/cn';

interface Props extends HTMLAttributes<HTMLTableRowElement> {
	children: Snippet;
	hoverable?: boolean;
	class?: string;
}

let { children, hoverable = true, class: className, ...rest }: Props = $props();
</script>

<tr
	class={cn(
		'border-b border-border transition-colors duration-fast',
		hoverable && 'hoverable',
		className
	)}
	{...rest}
>
	{@render children()}
</tr>

<style>
	tr.hoverable:hover {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}
</style>
