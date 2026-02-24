<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		minWidth?: string;
		children: Snippet;
	}

	let { minWidth = '280px', children }: Props = $props();
</script>

<nav class="nav-grid" style:--nav-grid-min={minWidth}>
	{@render children()}
</nav>

<style>
	.nav-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(var(--nav-grid-min, 280px), 1fr));
		gap: var(--spacing-6);
	}
</style>
