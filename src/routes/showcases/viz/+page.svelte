<script lang="ts">
	import { PageHeader, BackLink } from '$lib/components/composites';
	import { LinkCard } from '$lib/components';
</script>

<svelte:head>
	<title>Data Visualization - Showcases - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Data Visualization"
		description="Chart, plot, diagram, graph, and map components for data visualization."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'Viz' }
		]}
	/>

	<nav class="viz-nav">
		<LinkCard
			href="/showcases/viz/charts"
			icon="i-lucide-bar-chart-3"
			title="Charts"
			description="Bar, line, area, pie, and scatter charts powered by Chart.js"
		/>
		<LinkCard
			href="/showcases/viz/plots"
			icon="i-lucide-grid-3x3"
			title="Plots"
			description="Canvas-based heatmaps for dense data visualization"
		/>
		<LinkCard
			href="/showcases/viz/graphs"
			icon="i-lucide-share-2"
			title="Graphs"
			description="Network, directed, and tree graphs powered by D3-force and D3-hierarchy"
		/>
	</nav>

	<BackLink href="/showcases" label="Showcases" />
</div>

<style>
	.page {
		width: 100%;
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		box-sizing: border-box;
	}

	.viz-nav {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: var(--spacing-6);
	}

	@media (min-width: 768px) {
		.page {
			padding: var(--spacing-7);
		}
	}

	@media (max-width: 640px) {
		.page {
			padding: var(--spacing-4);
		}
	}
</style>
