<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		layout?: 'row' | 'grid';
		children: Snippet;
		class?: string;
	}

	let { layout = 'row', children, class: className }: Props = $props();
</script>

<div class={cn('variant-container', layout, className)}>
	{@render children()}
</div>

<style>
	.variant-container {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		width: 100%;
	}

	.variant-container.row {
		flex-direction: row;
		align-items: center;
	}

	.variant-container.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
	}

	@media (max-width: 640px) {
		.variant-container.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
