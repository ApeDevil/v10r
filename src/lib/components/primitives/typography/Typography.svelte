<script lang="ts">
	import type { Snippet } from 'svelte';
	import { typographyVariants, type TypographyVariants } from './typography';
	import { cn } from '$lib/utils/cn';

	type Element = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div' | 'blockquote' | 'code' | 'pre';

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
		large: 'p',
		small: 'span',
		muted: 'span',
		code: 'code',
		blockquote: 'blockquote'
	};

	let element = $derived(as || elementMap[variant] || 'p');
</script>

<svelte:element this={element} class={cn(typographyVariants({ variant }), className)}>
	{@render children()}
</svelte:element>
