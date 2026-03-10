<script lang="ts">
import { Card, ReorderablePaneLayout } from '$lib/components';
import type { PaneDefinition } from '$lib/components/composites/reorderable-panes';

const basicPanes: PaneDefinition[] = [
	{ id: 'nav', label: 'Navigation', defaultSize: 20, minSize: 15, maxSize: 30 },
	{ id: 'content', label: 'Content', defaultSize: 60, minSize: 30 },
	{ id: 'inspector', label: 'Inspector', defaultSize: 20, minSize: 15, maxSize: 30 },
];

const collapsiblePanes: PaneDefinition[] = [
	{
		id: 'sidebar',
		label: 'Sidebar',
		defaultSize: 25,
		minSize: 15,
		collapsible: true,
		collapsedSize: 0,
	},
	{ id: 'main', label: 'Main', defaultSize: 50, minSize: 30 },
	{
		id: 'details',
		label: 'Details',
		defaultSize: 25,
		minSize: 15,
		collapsible: true,
		collapsedSize: 0,
	},
];

const verticalPanes: PaneDefinition[] = [
	{ id: 'editor', label: 'Editor', defaultSize: 60, minSize: 30 },
	{ id: 'terminal', label: 'Terminal', defaultSize: 40, minSize: 20 },
];
</script>

<svelte:head>
	<title>Reorderable Splits - UI Showcase - Velociraptor</title>
</svelte:head>

<main class="content">
	<!-- Basic Reorderable -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Basic Reorderable</h2>
		<p class="text-fluid-base text-muted mb-fluid-4">
			Three panes with a tab bar above. Drag the grip icon to reorder tabs, or use Arrow keys
			when a grip is focused. Panes keep their width when reordered.
		</p>

		<Card>
			<div class="h-96">
				<ReorderablePaneLayout panes={basicPanes} direction="horizontal">
					{#snippet children(pane)}
						{#if pane.id === 'nav'}
							<div class="panel-content panel-surface-1">
								<h3 class="text-fluid-base font-semibold mb-2">Navigation</h3>
								<p class="text-fluid-xs text-muted">
									Sidebar for navigation items. Try dragging the grip icon in the tab bar to
									reorder.
								</p>
							</div>
						{:else if pane.id === 'content'}
							<div class="panel-content panel-surface-0">
								<h3 class="text-fluid-base font-semibold mb-2">Main Content</h3>
								<p class="text-fluid-sm text-muted">
									Primary content area. Notice how the pane keeps its width when reordered.
								</p>
							</div>
						{:else if pane.id === 'inspector'}
							<div class="panel-content panel-surface-1">
								<h3 class="text-fluid-base font-semibold mb-2">Inspector</h3>
								<p class="text-fluid-xs text-muted">
									Properties or details pane. Resize still works independently of reorder.
								</p>
							</div>
						{/if}
					{/snippet}
				</ReorderablePaneLayout>
			</div>
		</Card>
	</section>

	<!-- Reorderable + Collapsible -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Reorderable + Collapsible</h2>
		<p class="text-fluid-base text-muted mb-fluid-4">
			Side panes can be collapsed by dragging past the minimum size. Reorder still works after
			collapse/expand.
		</p>

		<Card>
			<div class="h-96">
				<ReorderablePaneLayout panes={collapsiblePanes} direction="horizontal">
					{#snippet children(pane)}
						{#if pane.id === 'sidebar'}
							<div class="panel-content panel-surface-1">
								<h3 class="text-fluid-base font-semibold mb-2">Sidebar</h3>
								<p class="text-fluid-xs text-muted">Drag past minimum to collapse.</p>
							</div>
						{:else if pane.id === 'main'}
							<div class="panel-content panel-surface-0">
								<h3 class="text-fluid-base font-semibold mb-2">Main</h3>
								<p class="text-fluid-sm text-muted">
									Expands when side panes collapse.
								</p>
							</div>
						{:else if pane.id === 'details'}
							<div class="panel-content panel-surface-1">
								<h3 class="text-fluid-base font-semibold mb-2">Details</h3>
								<p class="text-fluid-xs text-muted">Also collapsible.</p>
							</div>
						{/if}
					{/snippet}
				</ReorderablePaneLayout>
			</div>
		</Card>
	</section>

	<!-- Persistent Reorderable -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Persistent Layout</h2>
		<p class="text-fluid-base text-muted mb-fluid-4">
			Both pane order and sizes are saved to localStorage. Reorder and resize, then refresh the
			page to see them restored.
		</p>

		<Card>
			<div class="h-80">
				<ReorderablePaneLayout
					panes={basicPanes}
					direction="horizontal"
					persistId="showcase-reorderable"
				>
					{#snippet children(pane)}
						{#if pane.id === 'nav'}
							<div class="panel-content panel-surface-1">
								<h3 class="text-fluid-base font-semibold mb-2">Navigation</h3>
								<p class="text-fluid-xs text-muted">Reorder me, then refresh.</p>
							</div>
						{:else if pane.id === 'content'}
							<div class="panel-content panel-surface-0">
								<h3 class="text-fluid-base font-semibold mb-2">Content</h3>
								<p class="text-fluid-sm text-muted">Layout persists across reloads.</p>
							</div>
						{:else if pane.id === 'inspector'}
							<div class="panel-content panel-surface-1">
								<h3 class="text-fluid-base font-semibold mb-2">Inspector</h3>
								<p class="text-fluid-xs text-muted">Order + sizes saved.</p>
							</div>
						{/if}
					{/snippet}
				</ReorderablePaneLayout>
			</div>
		</Card>
	</section>

	<!-- Vertical Direction -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Vertical Layout</h2>
		<p class="text-fluid-base text-muted mb-fluid-4">
			Side list for vertical direction. Grip icons and Arrow Up/Down for keyboard reorder.
		</p>

		<Card>
			<div class="h-96">
				<ReorderablePaneLayout panes={verticalPanes} direction="vertical">
					{#snippet children(pane)}
						{#if pane.id === 'editor'}
							<div class="panel-content panel-surface-0">
								<h3 class="text-fluid-base font-semibold mb-2">Editor</h3>
								<p class="text-fluid-sm text-muted">
									Top pane. Use the side list to reorder vertically.
								</p>
							</div>
						{:else if pane.id === 'terminal'}
							<div class="panel-content panel-surface-1">
								<h3 class="text-fluid-base font-semibold mb-2">Terminal</h3>
								<p class="text-fluid-sm text-muted">
									Bottom pane. Arrow Up/Down on the grip to reorder.
								</p>
							</div>
						{/if}
					{/snippet}
				</ReorderablePaneLayout>
			</div>
		</Card>
	</section>

	<!-- Props Reference -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Component Props</h2>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-fluid-4">
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">ReorderablePaneLayout</h3>
				{/snippet}

				<div class="space-y-2 text-fluid-sm">
					<div>
						<code class="bg-subtle px-1 rounded">panes</code>
						<p class="text-muted">PaneDefinition[] -- pane definitions</p>
					</div>
					<div>
						<code class="bg-subtle px-1 rounded">direction</code>
						<p class="text-muted">'horizontal' | 'vertical'</p>
						<p class="text-xs text-muted">Default: 'horizontal'</p>
					</div>
					<div>
						<code class="bg-subtle px-1 rounded">persistId</code>
						<p class="text-muted">localStorage key for order + size persistence</p>
					</div>
					<div>
						<code class="bg-subtle px-1 rounded">children</code>
						<p class="text-muted">Snippet&lt;[PaneDefinition]&gt; -- pane content renderer</p>
					</div>
				</div>
			</Card>

			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">PaneDefinition</h3>
				{/snippet}

				<div class="space-y-2 text-fluid-sm">
					<div>
						<code class="bg-subtle px-1 rounded">id</code>
						<p class="text-muted">Unique pane identifier</p>
					</div>
					<div>
						<code class="bg-subtle px-1 rounded">label</code>
						<p class="text-muted">Display name in tab bar</p>
					</div>
					<div>
						<code class="bg-subtle px-1 rounded">defaultSize</code>
						<p class="text-muted">Initial size percentage (0-100)</p>
					</div>
					<div>
						<code class="bg-subtle px-1 rounded">minSize / maxSize</code>
						<p class="text-muted">Size constraints (percentage)</p>
					</div>
					<div>
						<code class="bg-subtle px-1 rounded">collapsible / collapsedSize</code>
						<p class="text-muted">Allow collapse past minimum</p>
					</div>
				</div>
			</Card>
		</div>
	</section>

	<!-- Accessibility -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Accessibility</h2>

		<Card>
			<div class="space-y-fluid-3">
				<div>
					<h4 class="text-fluid-base font-semibold mb-2">Keyboard Reorder</h4>
					<ul class="list-disc list-inside text-fluid-sm text-muted space-y-1">
						<li>Tab to focus a grip handle in the tab bar</li>
						<li>Arrow Left/Right to reorder (horizontal layout)</li>
						<li>Arrow Up/Down to reorder (vertical layout)</li>
						<li>Focus follows the moved tab</li>
					</ul>
				</div>
				<div>
					<h4 class="text-fluid-base font-semibold mb-2">Screen Reader</h4>
					<ul class="list-disc list-inside text-fluid-sm text-muted space-y-1">
						<li>
							Tab bar uses <code class="bg-subtle px-1 rounded">role="list"</code> (panes are always
							visible)
						</li>
						<li>Reorder announcements via aria-live region</li>
						<li>Grip handles have descriptive aria-labels</li>
					</ul>
				</div>
				<div>
					<h4 class="text-fluid-base font-semibold mb-2">Motion & Contrast</h4>
					<ul class="list-disc list-inside text-fluid-sm text-muted space-y-1">
						<li>
							<code class="bg-subtle px-1 rounded">prefers-reduced-motion</code> disables drag animations
						</li>
						<li>Drop indicator uses system colors for high contrast mode</li>
					</ul>
				</div>
			</div>
		</Card>
	</section>
</main>

<style>
	.content {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-fluid-6);
	}

	.panel-content {
		height: 100%;
		padding: var(--spacing-fluid-4);
	}

	.panel-surface-0 {
		background: var(--color-surface-0, var(--surface-0));
	}

	.panel-surface-1 {
		background: var(--color-surface-1, var(--surface-1));
	}
</style>
