<script lang="ts">
import { LinkCard } from '$lib/components';
import { BackLink, NavGrid, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
import * as m from '$lib/paraglide/messages';
</script>
<PageContainer class="py-7">
	<PageHeader
		title={m.showcase_viz_title()}
		description={m.showcase_viz_description()}
		breadcrumbs={[
			{ label: m.showcase_breadcrumb_home(), href: '/' },
			{ label: m.showcase_breadcrumb_showcases(), href: '/showcases' },
			{ label: m.showcase_viz_breadcrumb() }
		]}
	/>

	<NavGrid>
		<LinkCard
			href="/showcases/viz/charts"
			icon="i-lucide-bar-chart-3"
			title={m.showcase_viz_card_charts_title()}
			description={m.showcase_viz_card_charts_desc()}
		/>
		<LinkCard
			href="/showcases/viz/plots"
			icon="i-lucide-grid-3x3"
			title={m.showcase_viz_card_plots_title()}
			description={m.showcase_viz_card_plots_desc()}
		/>
		<LinkCard
			href="/showcases/viz/diagrams"
			icon="i-lucide-workflow"
			title={m.showcase_viz_card_diagrams_title()}
			description={m.showcase_viz_card_diagrams_desc()}
		/>
		<LinkCard
			href="/showcases/viz/graphs"
			icon="i-lucide-share-2"
			title={m.showcase_viz_card_graphs_title()}
			description={m.showcase_viz_card_graphs_desc()}
		/>
		<LinkCard
			href="/showcases/viz/maps"
			icon="i-lucide-map-pin"
			title={m.showcase_viz_card_maps_title()}
			description={m.showcase_viz_card_maps_desc()}
		/>
	</NavGrid>

	<BackLink href="/showcases" label={m.showcase_breadcrumb_showcases()} />
</PageContainer>
