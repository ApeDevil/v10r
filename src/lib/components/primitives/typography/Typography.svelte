<script lang="ts">
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';
import { type TypographyVariants, typographyVariants } from './typography';

type Element = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div' | 'code' | 'pre';

interface Props extends TypographyVariants {
	as?: Element;
	children: Snippet;
	class?: string;
}

let { as, variant = 'body', class: className, children }: Props = $props();

// Map variant to default element when 'as' is not provided
const elementMap: Record<NonNullable<typeof variant>, Element> = {
	h1: 'h1',
	h2: 'h2',
	h3: 'h3',
	h4: 'h4',
	h5: 'h5',
	h6: 'h6',
	body: 'p',
	lead: 'p',
	muted: 'span',
	code: 'code',
};

let element = $derived(as || (variant ? elementMap[variant as keyof typeof elementMap] : null) || 'p');
</script>

<svelte:element this={element} class={cn(typographyVariants({ variant }), className)}>
	{@render children()}
</svelte:element>
