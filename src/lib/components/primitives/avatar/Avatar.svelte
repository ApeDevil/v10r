<script lang="ts">
import { cn } from '$lib/utils/cn';

interface Props {
	src?: string | null;
	alt?: string;
	fallback?: string;
	size?: 'sm' | 'md' | 'lg';
	class?: string;
}

let { src, alt = '', fallback = '?', size = 'md', class: className }: Props = $props();

let imageError = $state(false);

const sizes = {
	sm: 'h-8 w-8 text-fluid-xs',
	md: 'h-10 w-10 text-fluid-sm',
	lg: 'h-12 w-12 text-fluid-base',
};

// Generate initials from fallback
let initials = $derived(
	fallback
		.split(' ')
		.map((n) => n[0])
		.join('')
		.slice(0, 2)
		.toUpperCase(),
);
</script>

<div
	class={cn(
		'relative flex shrink-0 items-center justify-center rounded-full avatar-bg overflow-hidden',
		sizes[size],
		className
	)}
>
	{#if src && !imageError}
		<img {src} {alt} class="h-full w-full object-cover" onerror={() => (imageError = true)} />
	{:else}
		<span class="font-medium text-muted">{initials}</span>
	{/if}
</div>

<style>
	/* UnoCSS can't apply opacity modifiers to CSS custom property colors */
	.avatar-bg {
		background-color: color-mix(in srgb, var(--color-muted) 20%, transparent);
	}
</style>
