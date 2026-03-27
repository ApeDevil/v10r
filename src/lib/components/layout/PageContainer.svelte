<script lang="ts">
/**
 * PageContainer — Full-page wrapper with responsive `padding-inline` and `max-width`
 * from design tokens. Used for top-level page shells.
 *
 */

import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { layout } from '$lib/styles/tokens';
import { cn } from '$lib/utils/cn';

type Width = 'content' | 'default' | 'wide';

interface Props extends HTMLAttributes<HTMLDivElement> {
	/** Width constraint (content: 65ch, default: 80rem, wide: 90rem) */
	width?: Width;
	children: Snippet;
}

let { width = 'default', class: className, children, ...rest }: Props = $props();

// Map width types to CSS custom properties
const widthStyles: Record<Width, string> = {
	content: layout.contentWidth,
	default: layout.maxWidth,
	wide: layout.wideWidth,
};
</script>

<div
	class={cn('mx-auto w-full', className)}
	style:max-width={widthStyles[width]}
	style:padding-inline="clamp(1rem, 3vw, 2rem)"
	{...rest}
>
	{@render children()}
</div>
