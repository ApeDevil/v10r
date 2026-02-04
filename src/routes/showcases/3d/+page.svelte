<script lang="ts">
	import { EmptyState } from '$lib/components/composites/empty-state';
</script>

<svelte:head>
	<title>3D - Showcases - Velociraptor</title>
</svelte:head>

<div class="page">
	<h1>3D Showcase</h1>
	<p>Placeholder for Three.js + Threlte 3D demonstrations.</p>

	<EmptyState
		icon="i-lucide-box"
		title="Coming Soon"
		description="Interactive 3D scenes with physics, animations, and WebGPU rendering."
	/>

	<a href="/showcases" class="back-link">← Back to Showcases</a>
</div>

<style>
	.page {
		max-width: var(--layout-narrow-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
	}

	h1 {
		font-size: var(--text-fluid-3xl);
		margin-bottom: var(--spacing-4);
		color: var(--color-fg);
	}

	p {
		color: var(--color-muted);
		margin-bottom: var(--spacing-7);
	}

	.back-link {
		display: inline-block;
		margin-top: var(--spacing-7);
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 600;
	}

	.back-link:hover {
		text-decoration: underline;
	}
</style>
