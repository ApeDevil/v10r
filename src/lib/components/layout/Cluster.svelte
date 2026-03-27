<script lang="ts">
/**
 * Cluster - Horizontal layout with wrapping and alignment.
 * Use for button groups, tag clouds, toolbars.
 */

import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { cn } from '$lib/utils/cn';

type Gap = '0' | '1' | '2' | '3' | '4' | '5' | '6';
type Justify = 'start' | 'center' | 'end' | 'between' | 'around';
type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';

interface Props extends HTMLAttributes<HTMLDivElement> {
	/** Gap between children (fixed scale: 0-6) */
	gap?: Gap;
	/** Horizontal alignment */
	justify?: Justify;
	/** Vertical alignment */
	align?: Align;
	/** Allow wrapping (default: true) */
	wrap?: boolean;
	children: Snippet;
}

let {
	gap = '3',
	justify = 'start',
	align = 'center',
	wrap = true,
	class: className,
	children,
	...rest
}: Props = $props();

// @unocss-include
const gapClasses: Record<Gap, string> = {
	'0': 'gap-0',
	'1': 'gap-1',
	'2': 'gap-2',
	'3': 'gap-3',
	'4': 'gap-4',
	'5': 'gap-5',
	'6': 'gap-6',
};

const justifyClasses: Record<Justify, string> = {
	start: 'justify-start',
	center: 'justify-center',
	end: 'justify-end',
	between: 'justify-between',
	around: 'justify-around',
};

const alignClasses: Record<Align, string> = {
	start: 'items-start',
	center: 'items-center',
	end: 'items-end',
	stretch: 'items-stretch',
	baseline: 'items-baseline',
};
</script>

<div
	class={cn(
		'flex',
		wrap && 'flex-wrap',
		gapClasses[gap],
		justifyClasses[justify],
		alignClasses[align],
		className
	)}
	{...rest}
>
	{@render children()}
</div>
