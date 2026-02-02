<script lang="ts">
	/**
	 * Section - Section wrapper with title, description, and scroll-margin for anchor links.
	 * Use for page sections with optional title and description.
	 */

	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	interface Props extends Omit<HTMLAttributes<HTMLElement>, 'id'> {
		/** Section ID (for anchor links) */
		id: string;
		/** Section title */
		title: string;
		/** Optional description */
		description?: string;
		children: Snippet;
	}

	let { id, title, description, class: className, children, ...rest }: Props = $props();
</script>

<section
	{id}
	class={cn('scroll-mt-20', className)}
	{...rest}
>
	<div class="mb-6">
		<h2 class="text-fluid-2xl font-semibold mb-2">{title}</h2>
		{#if description}
			<p class="text-muted text-fluid-base">{description}</p>
		{/if}
	</div>
	{@render children()}
</section>
