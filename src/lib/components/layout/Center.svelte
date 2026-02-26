<script lang="ts">
	/**
	 * Center — Simple centering with Tailwind `max-w-*` classes.
	 * Used for content sections within a page.
	 *
	 * For full-page wrappers with design-token widths and responsive padding, use `PageContainer`.
	 */

	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	type MaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'prose';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** Max width constraint */
		max?: MaxWidth;
		/** Horizontal padding (default: true) */
		gutter?: boolean;
		children: Snippet;
	}

	let { max = '4xl', gutter = true, class: className, children, ...rest }: Props = $props();

	// @unocss-include
	const maxClasses: Record<MaxWidth, string> = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-lg',
		xl: 'max-w-xl',
		'2xl': 'max-w-2xl',
		'3xl': 'max-w-3xl',
		'4xl': 'max-w-4xl',
		'5xl': 'max-w-5xl',
		'6xl': 'max-w-6xl',
		'7xl': 'max-w-7xl',
		prose: 'max-w-prose',
	};
</script>

<div class={cn('mx-auto w-full', maxClasses[max], gutter && 'px-4', className)} {...rest}>
	{@render children()}
</div>
