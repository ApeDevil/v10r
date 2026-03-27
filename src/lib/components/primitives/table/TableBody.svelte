<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { cn } from '$lib/utils/cn';

interface Props extends HTMLAttributes<HTMLTableSectionElement> {
	children: Snippet;
	class?: string;
}

let { children, class: className, ...rest }: Props = $props();
</script>

<tbody class={cn('[&_tr:last-child]:border-0', className)} {...rest}>
	{@render children()}
</tbody>
