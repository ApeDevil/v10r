<script lang="ts">
	import { Toggle as TogglePrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import { toggleVariants, type ToggleVariants } from './toggle';
	import type { Snippet } from 'svelte';

	interface Props extends ToggleVariants {
		pressed?: boolean;
		disabled?: boolean;
		class?: string;
		children: Snippet;
	}

	let {
		pressed = $bindable(false),
		disabled = false,
		variant = 'default',
		size = 'md',
		class: className,
		children
	}: Props = $props();
</script>

<TogglePrimitive.Root
	bind:pressed
	{disabled}
	class={cn(toggleVariants({ variant, size }), className)}
>
	{@render children()}
</TogglePrimitive.Root>
