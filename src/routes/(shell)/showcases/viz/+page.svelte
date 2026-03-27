<script lang="ts">
import { LinkCard } from '$lib/components';
import { BackLink, NavGrid, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
</script>

<svelte:head>
	<title>Data Visualization - Showcases - Velociraptor</title>
</svelte:head>

<PageContainer class="py-7">
	<PageHeader
		title="Data Visualization"
		description="Chart, plot, diagram, graph, and map components for data visualization."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'Viz' }
		]}
	/>

	<NavGrid>
		<LinkCard
			href="/showcases/viz/charts"
			icon="i-lucide-bar-chart-3"
			title="Charts"
			description="Bar, line, area, pie, radar, bubble, sparkline, gauge, and treemap charts"
		/>
		<LinkCard
			href="/showcases/viz/plots"
			icon="i-lucide-grid-3x3"
			title="Plots"
			description="Scatter plots and heatmaps for dense data visualization"
		/>
		<LinkCard
			href="/showcases/viz/diagrams"
			icon="i-lucide-workflow"
			title="Diagrams"
			description="Interactive flow diagrams and state machines powered by Svelte Flow"
		/>
		<LinkCard
			href="/showcases/viz/graphs"
			icon="i-lucide-share-2"
			title="Graphs"
			description="Network, directed, and tree graphs powered by D3-force and D3-hierarchy"
		/>
		<LinkCard
			href="/showcases/viz/maps"
			icon="i-lucide-map-pin"
			title="Maps"
			description="Interactive maps with markers, popups, and data layers powered by MapLibre GL"
		/>
	</NavGrid>

	<BackLink href="/showcases" label="Showcases" />
</PageContainer>
