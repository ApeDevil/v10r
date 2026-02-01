<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { buttonVariants, type ButtonVariants } from './button';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes, ButtonVariants {
		children: Snippet;
		class?: string;
	}

	let { variant, size, class: className, children, ...rest }: Props = $props();
</script>

<button class={cn(buttonVariants({ variant, size }), className)} {...rest}>
	{@render children()}
</button>
