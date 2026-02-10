<script lang="ts">
	import { PageHeader, BackLink } from '$lib/components/composites';
	import { LinkCard } from '$lib/components';
</script>

<svelte:head>
	<title>UI Showcase - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="UI Showcase"
		description="Explore all UI components, design tokens, and patterns used in Velociraptor."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'UI' }
		]}
	/>

	<nav class="hub-nav">
		<LinkCard
			href="/showcases/ui/primitives"
			icon="i-lucide-blocks"
			title="Primitives"
			description="Buttons, inputs, badges, avatars, dialogs, and other foundational elements"
		/>
		<LinkCard
			href="/showcases/ui/composites"
			icon="i-lucide-package"
			title="Composites"
			description="Alerts, toasts, cards, navigation, pagination, and form patterns"
		/>
		<LinkCard
			href="/showcases/ui/typography"
			icon="i-lucide-type"
			title="Typography"
			description="Headings, body text, lead text, and semantic text styles"
		/>
		<LinkCard
			href="/showcases/ui/layouts"
			icon="i-lucide-layout-grid"
			title="Layouts"
			description="Stack, cluster, grid, center, and resizable pane primitives"
		/>
		<LinkCard
			href="/showcases/ui/panes"
			icon="i-lucide-panel-left"
			title="Resizable Panes"
			description="Draggable split layouts with persistence, collapsible panes, and keyboard support"
		/>
		<LinkCard
			href="/showcases/ui/tokens"
			icon="i-lucide-palette"
			title="Theme Tokens"
			description="Colors, spacing, typography scale, shadows, and radii"
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

	.hub-nav {
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
