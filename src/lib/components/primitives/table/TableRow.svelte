<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

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
		hoverable && 'hover:bg-muted/5',
		className
	)}
	{...rest}
>
	{@render children()}
</tr>
