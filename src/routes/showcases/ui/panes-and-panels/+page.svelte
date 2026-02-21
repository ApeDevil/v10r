<script lang="ts">
	import { PageHeader, BackLink, Card } from '$lib/components';
	import { LinkCard } from '$lib/components';
</script>

<svelte:head>
	<title>Panes & Panels - UI Showcase - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Panes & Panels"
		description="Two distinct concepts: panes divide space, panels organize content."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'UI', href: '/showcases/ui' },
			{ label: 'Panes & Panels' }
		]}
	/>

	<main class="content">
		<!-- Mental model -->
		<section>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-fluid-4">
				<Card>
					<h2 class="text-fluid-xl font-bold mb-fluid-3">Panes</h2>
					<p class="text-fluid-sm text-muted mb-fluid-3">
						Resizable spatial containers. Panes answer: "How is space divided?"
					</p>
					<ul class="list-disc list-inside text-fluid-sm text-muted space-y-1">
						<li>Drag resize handles between regions</li>
						<li>No content identity — just geometry</li>
						<li>Keyboard and touch support</li>
						<li>Persistence via localStorage</li>
					</ul>
				</Card>

				<Card>
					<h2 class="text-fluid-xl font-bold mb-fluid-3">Panels</h2>
					<p class="text-fluid-sm text-muted mb-fluid-3">
						Content units with identity. Panels answer: "What content goes where?"
					</p>
					<ul class="list-disc list-inside text-fluid-sm text-muted space-y-1">
						<li>Named, movable content (Explorer, Terminal, etc.)</li>
						<li>Tabs, drag-to-split, close, activity bar</li>
						<li>Multiple instances of the same type</li>
						<li>Built on top of panes</li>
					</ul>
				</Card>
			</div>
		</section>

		<!-- Relationship diagram -->
		<section>
			<Card>
				<h3 class="text-fluid-lg font-semibold mb-fluid-3">How they relate</h3>
				<pre class="text-fluid-sm text-muted font-mono overflow-x-auto">Pane (resizable box)
  └─ Panel Stack (leaf with tabs)
      ├─ Panel "Explorer"
      ├─ Panel "Search"
      └─ Panel "Terminal"</pre>
				<p class="text-fluid-sm text-muted mt-fluid-3">
					Panes are the skeleton. Panels are the organs. A pane can hold multiple panels stacked as tabs. A panel always lives inside a pane.
				</p>
			</Card>
		</section>

		<!-- Navigation -->
		<section>
			<h2 class="text-fluid-xl font-bold mb-fluid-3">Pane Showcases</h2>
			<p class="text-fluid-sm text-muted mb-fluid-4">
				Resizable containers — spatial division without content awareness.
			</p>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-fluid-4">
				<LinkCard
					href="/showcases/ui/panes-and-panels/panes"
					icon="i-lucide-columns-3"
					title="Resizable Panes"
					description="PaneForge primitives: horizontal, vertical, three-panel, persistent, collapsible layouts"
				/>
				<LinkCard
					href="/showcases/ui/panes-and-panels/panes/reorderable"
					icon="i-lucide-grip-vertical"
					title="Reorderable Panes"
					description="Drag-to-reorder tab bar built on top of PaneForge with keyboard support"
				/>
			</div>
		</section>

		<section>
			<h2 class="text-fluid-xl font-bold mb-fluid-3">Panel Showcases</h2>
			<p class="text-fluid-sm text-muted mb-fluid-4">
				Content units with identity — movable, tabbable, closable.
			</p>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-fluid-4">
				<LinkCard
					href="/showcases/ui/panes-and-panels/panels"
					icon="i-lucide-panel-left"
					title="Dock Panels"
					description="VS Code-style docking with drag-to-split, tabbed panels, activity bar, and binary tree layout"
				/>
			</div>
		</section>
	</main>

	<BackLink href="/showcases/ui" label="UI" />
</div>

<style>
	.page {
		width: 100%;
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		box-sizing: border-box;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-fluid-6);
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
