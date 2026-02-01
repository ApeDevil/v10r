<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLTableElement> {
		children: Snippet;
		striped?: boolean;
		class?: string;
	}

	let { children, striped = false, class: className, ...rest }: Props = $props();
</script>

<div class="relative w-full overflow-auto">
	<table class={cn('w-full caption-bottom text-fluid-sm', className)} {...rest}>
		{@render children()}
	</table>
</div>

<!-- Sub-components using context would be ideal, but for simplicity we'll use direct exports -->
<script module lang="ts">
	export { default as Header } from './TableHeader.svelte';
	export { default as Body } from './TableBody.svelte';
	export { default as Row } from './TableRow.svelte';
	export { default as HeaderCell } from './TableHeaderCell.svelte';
	export { default as Cell } from './TableCell.svelte';
</script>
