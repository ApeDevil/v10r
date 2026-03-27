<script lang="ts">
import { Card } from '$lib/components';
import { Pane, PaneGroup, PaneResizer } from '$lib/components/primitives';
</script>

<svelte:head>
	<title>Resizable Splits - UI Showcase - Velociraptor</title>
</svelte:head>

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
						<div class="h-full bg-bg p-fluid-4 border-r border-border">
							<h3 class="text-fluid-base font-semibold mb-2">Main Content</h3>
							<p class="text-fluid-sm text-muted">
								Primary content area. Takes the majority of the space by default.
							</p>
							<p class="text-fluid-sm text-muted mt-2">
								Uses bg to distinguish from the side panes.
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

</main>

<style>
	.content {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-fluid-6);
	}
</style>
