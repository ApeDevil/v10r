<script lang="ts">
	/**
	 * Stack - Vertical layout with consistent gaps.
	 * Use for stacking elements vertically with uniform spacing.
	 */

	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	type Gap = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** Gap between children (fixed scale: 0-8) */
		gap?: Gap;
		children: Snippet;
	}

	let { gap = '4', class: className, children, ...rest }: Props = $props();

	// @unocss-include
	const gapClasses: Record<Gap, string> = {
		'0': 'gap-0',
		'1': 'gap-1',
		'2': 'gap-2',
		'3': 'gap-3',
		'4': 'gap-4',
		'5': 'gap-5',
		'6': 'gap-6',
		'7': 'gap-7',
		'8': 'gap-8',
	};
</script>

<div class={cn('flex flex-col', gapClasses[gap], className)} {...rest}>
	{@render children()}
</div>
