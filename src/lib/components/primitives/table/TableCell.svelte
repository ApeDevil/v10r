<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLTdAttributes } from 'svelte/elements';
import { cn } from '$lib/utils/cn';

interface Props extends HTMLTdAttributes {
	children?: Snippet;
	class?: string;
}

let { children, class: className, ...rest }: Props = $props();
</script>

<td
	class={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)}
	{...rest}
>
	{#if children}{@render children()}{/if}
</td>
