<script lang="ts">
	/**
	 * Grid - CSS Grid with consistent gaps.
	 * Use for card grids, form layouts, dashboards.
	 */

	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	type Cols = 1 | 2 | 3 | 4 | 5 | 6 | 12;
	type Gap = '0' | '1' | '2' | '3' | '4' | '5' | '6';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** Number of columns */
		cols?: Cols;
		/** Gap between items (fixed scale: 0-6) */
		gap?: Gap;
		children: Snippet;
	}

	let { cols = 1, gap = '4', class: className, children, ...rest }: Props = $props();

	// @unocss-include
	const colClasses: Record<Cols, string> = {
		1: 'grid-cols-1',
		2: 'grid-cols-2',
		3: 'grid-cols-3',
		4: 'grid-cols-4',
		5: 'grid-cols-5',
		6: 'grid-cols-6',
		12: 'grid-cols-12',
	};

	const gapClasses: Record<Gap, string> = {
		'0': 'gap-0',
		'1': 'gap-1',
		'2': 'gap-2',
		'3': 'gap-3',
		'4': 'gap-4',
		'5': 'gap-5',
		'6': 'gap-6',
	};
</script>

<div class={cn('grid', colClasses[cols], gapClasses[gap], className)} {...rest}>
	{@render children()}
</div>
