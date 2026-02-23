<script lang="ts">
	import { PageHeader, Card, BackLink } from '$lib/components';
	import { PaneGroup, Pane, PaneResizer } from '$lib/components/primitives';
</script>

<svelte:head>
	<title>Resizable Panes - UI Showcase - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Resizable Panes"
		description="Resizable spatial containers powered by PaneForge. Panes divide space — they have no content identity, just geometry."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'UI', href: '/showcases/ui' },
			{ label: 'Panes & Panels', href: '/showcases/ui/panes-and-panels' },
			{ label: 'Panes' }
		]}
	/>

	<main class="content">
		<!-- Basic Horizontal Example -->
		<section>
			<h2 class="text-fluid-2xl font-bold mb-fluid-3">Horizontal Layout</h2>
			<p class="text-fluid-base text-muted mb-fluid-4">
				Two panes side-by-side with a draggable divider. Includes visual grip indicator.
			</p>

			<Card>
				<div class="h-[20rem]">
					<PaneGroup direction="horizontal">
						<Pane defaultSize={50} minSize={20} maxSize={80}>
							<div class="h-full bg-surface-1 p-fluid-4 rounded-l-lg border-r border-border">
								<h3 class="text-fluid-lg font-semibold mb-2">Left Pane</h3>
								<p class="text-fluid-sm text-muted">
									This pane starts at 50% width. It can be resized between 20% and 80% of the total
									width.
								</p>
								<p class="text-fluid-sm text-muted mt-2">
									Try dragging the divider or using arrow keys when focused on it.
								</p>
							</div>
						</Pane>

						<PaneResizer withHandle={true} />

						<Pane defaultSize={50} minSize={20} maxSize={80}>
							<div class="h-full bg-surface-1 p-fluid-4 rounded-r-lg">
								<h3 class="text-fluid-lg font-semibold mb-2">Right Pane</h3>
								<p class="text-fluid-sm text-muted">
									This pane fills the remaining space. Resize constraints ensure neither pane
									becomes too small or too large.
								</p>
							</div>
						</Pane>
					</PaneGroup>
				</div>
			</Card>
		</section>

		<!-- Vertical Layout Example -->
		<section>
			<h2 class="text-fluid-2xl font-bold mb-fluid-3">Vertical Layout</h2>
			<p class="text-fluid-base text-muted mb-fluid-4">
				Stacked panes with a horizontal divider. Cursor changes to row-resize for vertical splits.
			</p>

			<Card>
				<div class="h-[24rem]">
					<PaneGroup direction="vertical">
						<Pane defaultSize={60} minSize={30}>
							<div class="h-full bg-surface-1 p-fluid-4 rounded-t-lg border-b border-border">
								<h3 class="text-fluid-lg font-semibold mb-2">Top Pane</h3>
								<p class="text-fluid-sm text-muted">
									This pane occupies 60% of the height initially. The vertical divider below can be
									dragged to adjust the split.
								</p>
							</div>
						</Pane>

						<PaneResizer withHandle={true} />

						<Pane defaultSize={40} minSize={30}>
							<div class="h-full bg-surface-1 p-fluid-4 rounded-b-lg">
								<h3 class="text-fluid-lg font-semibold mb-2">Bottom Pane</h3>
								<p class="text-fluid-sm text-muted">
									This pane takes the remaining 40% height. Both panes maintain a minimum of 30% to
									ensure usability.
								</p>
							</div>
						</Pane>
					</PaneGroup>
				</div>
			</Card>
		</section>

		<!-- Three Panel Example -->
		<section>
			<h2 class="text-fluid-2xl font-bold mb-fluid-3">Three-Pane Layout</h2>
			<p class="text-fluid-base text-muted mb-fluid-4">
				Multiple panes with independent resize handles. Common pattern for navigation, content, and
				sidebar.
			</p>

			<Card>
				<div class="h-[24rem]">
					<PaneGroup direction="horizontal">
						<Pane defaultSize={20} minSize={15} maxSize={30}>
							<div class="h-full bg-surface-1 p-fluid-4 border-r border-border">
								<h3 class="text-fluid-base font-semibold mb-2">Navigation</h3>
								<p class="text-fluid-xs text-muted">
									Sidebar for navigation items. Constrained to 15-30% width.
								</p>
							</div>
						</Pane>

						<PaneResizer withHandle={true} />

						<Pane defaultSize={60} minSize={40}>
							<div class="h-full bg-surface-0 p-fluid-4 border-r border-border">
								<h3 class="text-fluid-base font-semibold mb-2">Main Content</h3>
								<p class="text-fluid-sm text-muted">
									Primary content area. Takes the majority of the space by default.
								</p>
								<p class="text-fluid-sm text-muted mt-2">
									Uses surface-0 to distinguish from the side panes.
								</p>
							</div>
						</Pane>

						<PaneResizer withHandle={true} />

						<Pane defaultSize={20} minSize={15} maxSize={30}>
							<div class="h-full bg-surface-1 p-fluid-4">
								<h3 class="text-fluid-base font-semibold mb-2">Inspector</h3>
								<p class="text-fluid-xs text-muted">
									Right sidebar for properties or details. Same constraints as navigation.
								</p>
							</div>
						</Pane>
					</PaneGroup>
				</div>
			</Card>
		</section>

		<!-- Persistent Layout -->
		<section>
			<h2 class="text-fluid-2xl font-bold mb-fluid-3">Persistent Layout</h2>
			<p class="text-fluid-base text-muted mb-fluid-4">
				Layout is saved to localStorage via <code class="bg-subtle px-1 rounded">autoSaveId</code>. Resize the panes, then refresh the page to see them restored.
			</p>

			<Card>
				<div class="h-[16rem]">
					<PaneGroup direction="horizontal" autoSaveId="showcase-persistent">
						<Pane defaultSize={30} minSize={20}>
							<div class="h-full bg-surface-1 p-fluid-4 border-r border-border">
								<h3 class="text-fluid-lg font-semibold mb-2">Sidebar</h3>
								<p class="text-fluid-sm text-muted">Resize me, then refresh.</p>
							</div>
						</Pane>

						<PaneResizer withHandle={true} />

						<Pane defaultSize={70} minSize={30}>
							<div class="h-full bg-surface-1 p-fluid-4">
								<h3 class="text-fluid-lg font-semibold mb-2">Content</h3>
								<p class="text-fluid-sm text-muted">Layout persists across page reloads.</p>
							</div>
						</Pane>
					</PaneGroup>
				</div>
			</Card>
		</section>

		<!-- Collapsible Pane -->
		<section>
			<h2 class="text-fluid-2xl font-bold mb-fluid-3">Collapsible Pane</h2>
			<p class="text-fluid-base text-muted mb-fluid-4">
				The sidebar can be collapsed by dragging past the minimum size threshold.
			</p>

			<Card>
				<div class="h-[16rem]">
					<PaneGroup direction="horizontal">
						<Pane defaultSize={25} minSize={15} collapsible collapsedSize={0}>
							<div class="h-full bg-surface-1 p-fluid-4 border-r border-border">
								<h3 class="text-fluid-lg font-semibold mb-2">Collapsible</h3>
								<p class="text-fluid-sm text-muted">Drag past the minimum to collapse.</p>
							</div>
						</Pane>

						<PaneResizer withHandle={true} />

						<Pane defaultSize={75} minSize={30}>
							<div class="h-full bg-surface-1 p-fluid-4">
								<h3 class="text-fluid-lg font-semibold mb-2">Main</h3>
								<p class="text-fluid-sm text-muted">
									This pane expands when the sidebar collapses.
								</p>
							</div>
						</Pane>
					</PaneGroup>
				</div>
			</Card>
		</section>

		<!-- Without Handle Indicator -->
		<section>
			<h2 class="text-fluid-2xl font-bold mb-fluid-3">Minimal Divider</h2>
			<p class="text-fluid-base text-muted mb-fluid-4">
				Simple divider without the grip indicator. Cleaner look when visual affordance isn't needed.
			</p>

			<Card>
				<div class="h-[16rem]">
					<PaneGroup direction="horizontal">
						<Pane defaultSize={50}>
							<div class="h-full bg-surface-1 p-fluid-4 rounded-l-lg border-r border-border">
								<h3 class="text-fluid-lg font-semibold mb-2">Left</h3>
								<p class="text-fluid-sm text-muted">
									The divider is still draggable, just without the visual grip indicator.
								</p>
							</div>
						</Pane>

						<PaneResizer withHandle={false} />

						<Pane defaultSize={50}>
							<div class="h-full bg-surface-1 p-fluid-4 rounded-r-lg">
								<h3 class="text-fluid-lg font-semibold mb-2">Right</h3>
								<p class="text-fluid-sm text-muted">
									The cursor still changes on hover to indicate the resize capability.
								</p>
							</div>
						</Pane>
					</PaneGroup>
				</div>
			</Card>
		</section>

		<!-- Props Reference -->
		<section>
			<h2 class="text-fluid-2xl font-bold mb-fluid-3">Component Props</h2>

			<div class="grid grid-cols-1 lg:grid-cols-3 gap-fluid-4">
				<Card>
					{#snippet header()}
						<h3 class="text-fluid-lg font-semibold">PaneGroup</h3>
					{/snippet}

					<div class="space-y-2 text-fluid-sm">
						<div>
							<code class="bg-subtle px-1 rounded">direction</code>
							<p class="text-muted">'horizontal' | 'vertical'</p>
							<p class="text-xs text-muted">Default: 'horizontal'</p>
						</div>
						<div>
							<code class="bg-subtle px-1 rounded">autoSaveId</code>
							<p class="text-muted">localStorage key for persistence</p>
						</div>
						<div>
							<code class="bg-subtle px-1 rounded">onLayoutChange</code>
							<p class="text-muted">(layout: number[]) => void</p>
						</div>
					</div>
				</Card>

				<Card>
					{#snippet header()}
						<h3 class="text-fluid-lg font-semibold">Pane</h3>
					{/snippet}

					<div class="space-y-2 text-fluid-sm">
						<div>
							<code class="bg-subtle px-1 rounded">defaultSize</code>
							<p class="text-muted">Initial size percentage (0-100)</p>
						</div>
						<div>
							<code class="bg-subtle px-1 rounded">minSize</code>
							<p class="text-muted">Minimum size percentage</p>
						</div>
						<div>
							<code class="bg-subtle px-1 rounded">maxSize</code>
							<p class="text-muted">Maximum size percentage</p>
						</div>
						<div>
							<code class="bg-subtle px-1 rounded">collapsible</code>
							<p class="text-muted">Allow pane to collapse to 0</p>
						</div>
						<div>
							<code class="bg-subtle px-1 rounded">collapsedSize</code>
							<p class="text-muted">Size when collapsed (%)</p>
						</div>
					</div>
				</Card>

				<Card>
					{#snippet header()}
						<h3 class="text-fluid-lg font-semibold">PaneResizer</h3>
					{/snippet}

					<div class="space-y-2 text-fluid-sm">
						<div>
							<code class="bg-subtle px-1 rounded">withHandle</code>
							<p class="text-muted">Show visual grip indicator</p>
							<p class="text-xs text-muted">Default: false</p>
						</div>
						<div>
							<code class="bg-subtle px-1 rounded">disabled</code>
							<p class="text-muted">Disable resize interaction</p>
						</div>
						<div>
							<code class="bg-subtle px-1 rounded">onDraggingChange</code>
							<p class="text-muted">(isDragging: boolean) => void</p>
						</div>
					</div>
				</Card>
			</div>
		</section>

		<!-- Accessibility Features -->
		<section>
			<h2 class="text-fluid-2xl font-bold mb-fluid-3">Accessibility</h2>

			<Card>
				<div class="space-y-fluid-3">
					<div>
						<h4 class="text-fluid-base font-semibold mb-2">Keyboard Navigation</h4>
						<ul class="list-disc list-inside text-fluid-sm text-muted space-y-1">
							<li>Tab to focus the resize handle</li>
							<li>Arrow Left/Right for horizontal resizing</li>
							<li>Arrow Up/Down for vertical resizing</li>
							<li>Home/End to jump to min/max size</li>
						</ul>
					</div>

					<div>
						<h4 class="text-fluid-base font-semibold mb-2">Touch Support</h4>
						<ul class="list-disc list-inside text-fluid-sm text-muted space-y-1">
							<li>Touch drag on mobile devices</li>
							<li>Pointer events for unified input handling</li>
						</ul>
					</div>
				</div>
			</Card>
		</section>
	</main>

	<BackLink href="/showcases/ui/panes-and-panels" label="Panes & Panels" />
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
