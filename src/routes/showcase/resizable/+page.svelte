<script lang="ts">
	import { PageHeader, Card } from '$lib/components';
	import { ResizablePaneGroup, ResizablePane, ResizableHandle } from '$lib/components/primitives';
</script>

<PageHeader
	title="Resizable Panels"
	description="Custom resizable panel implementation with keyboard accessibility and visual drag indicators."
/>

<div class="max-w-layout-wide mx-auto space-y-fluid-6 p-fluid-4">
	<!-- Basic Horizontal Example -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Horizontal Layout</h2>
		<p class="text-fluid-base text-muted mb-fluid-4">
			Two panels side-by-side with a draggable divider. Includes visual grip indicator.
		</p>

		<Card>
			<div class="h-80">
				<ResizablePaneGroup direction="horizontal">
					<ResizablePane defaultSize={50} minSize={20} maxSize={80}>
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
					</ResizablePane>

					<ResizableHandle withHandle={true} />

					<ResizablePane defaultSize={50} minSize={20} maxSize={80}>
						<div class="h-full bg-surface-1 p-fluid-4 rounded-r-lg">
							<h3 class="text-fluid-lg font-semibold mb-2">Right Pane</h3>
							<p class="text-fluid-sm text-muted">
								This pane fills the remaining space. Resize constraints ensure neither panel
								becomes too small or too large.
							</p>
						</div>
					</ResizablePane>
				</ResizablePaneGroup>
			</div>
		</Card>
	</section>

	<!-- Vertical Layout Example -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Vertical Layout</h2>
		<p class="text-fluid-base text-muted mb-fluid-4">
			Stacked panels with a horizontal divider. Cursor changes to row-resize for vertical splits.
		</p>

		<Card>
			<div class="h-96">
				<ResizablePaneGroup direction="vertical">
					<ResizablePane defaultSize={60} minSize={30}>
						<div class="h-full bg-surface-1 p-fluid-4 rounded-t-lg border-b border-border">
							<h3 class="text-fluid-lg font-semibold mb-2">Top Pane</h3>
							<p class="text-fluid-sm text-muted">
								This pane occupies 60% of the height initially. The vertical divider below can be
								dragged to adjust the split.
							</p>
						</div>
					</ResizablePane>

					<ResizableHandle withHandle={true} />

					<ResizablePane defaultSize={40} minSize={30}>
						<div class="h-full bg-surface-1 p-fluid-4 rounded-b-lg">
							<h3 class="text-fluid-lg font-semibold mb-2">Bottom Pane</h3>
							<p class="text-fluid-sm text-muted">
								This pane takes the remaining 40% height. Both panes maintain a minimum of 30% to
								ensure usability.
							</p>
						</div>
					</ResizablePane>
				</ResizablePaneGroup>
			</div>
		</Card>
	</section>

	<!-- Three Panel Example -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Three-Panel Layout</h2>
		<p class="text-fluid-base text-muted mb-fluid-4">
			Multiple panels with independent resize handles. Common pattern for navigation, content, and
			sidebar.
		</p>

		<Card>
			<div class="h-96">
				<ResizablePaneGroup direction="horizontal">
					<ResizablePane defaultSize={20} minSize={15} maxSize={30}>
						<div class="h-full bg-surface-1 p-fluid-4 border-r border-border">
							<h3 class="text-fluid-base font-semibold mb-2">Navigation</h3>
							<p class="text-fluid-xs text-muted">
								Sidebar for navigation items. Constrained to 15-30% width.
							</p>
						</div>
					</ResizablePane>

					<ResizableHandle withHandle={true} />

					<ResizablePane defaultSize={60} minSize={40}>
						<div class="h-full bg-surface-0 p-fluid-4 border-r border-border">
							<h3 class="text-fluid-base font-semibold mb-2">Main Content</h3>
							<p class="text-fluid-sm text-muted">
								Primary content area. Takes the majority of the space by default.
							</p>
							<p class="text-fluid-sm text-muted mt-2">
								Uses surface-0 to distinguish from the side panels.
							</p>
						</div>
					</ResizablePane>

					<ResizableHandle withHandle={true} />

					<ResizablePane defaultSize={20} minSize={15} maxSize={30}>
						<div class="h-full bg-surface-1 p-fluid-4">
							<h3 class="text-fluid-base font-semibold mb-2">Inspector</h3>
							<p class="text-fluid-xs text-muted">
								Right sidebar for properties or details. Same constraints as navigation.
							</p>
						</div>
					</ResizablePane>
				</ResizablePaneGroup>
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
			<div class="h-64">
				<ResizablePaneGroup direction="horizontal">
					<ResizablePane defaultSize={50}>
						<div class="h-full bg-surface-1 p-fluid-4 rounded-l-lg border-r border-border">
							<h3 class="text-fluid-lg font-semibold mb-2">Left</h3>
							<p class="text-fluid-sm text-muted">
								The divider is still draggable, just without the visual grip indicator.
							</p>
						</div>
					</ResizablePane>

					<ResizableHandle withHandle={false} />

					<ResizablePane defaultSize={50}>
						<div class="h-full bg-surface-1 p-fluid-4 rounded-r-lg">
							<h3 class="text-fluid-lg font-semibold mb-2">Right</h3>
							<p class="text-fluid-sm text-muted">
								The cursor still changes on hover to indicate the resize capability.
							</p>
						</div>
					</ResizablePane>
				</ResizablePaneGroup>
			</div>
		</Card>
	</section>

	<!-- Implementation Guide -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Usage</h2>

		<Card>
			<div class="space-y-fluid-4">
				<div>
					<h4 class="text-fluid-base font-semibold mb-2">Basic Horizontal Split</h4>
					<pre
						class="bg-muted/5 p-3 rounded text-fluid-sm overflow-x-auto"><code>&lt;ResizablePaneGroup direction="horizontal"&gt;
  &lt;ResizablePane defaultSize={"{50}"} minSize={"{20}"} maxSize={"{80}"}&gt;
    &lt;div&gt;Left content&lt;/div&gt;
  &lt;/ResizablePane&gt;

  &lt;ResizableHandle withHandle={"{true}"} /&gt;

  &lt;ResizablePane defaultSize={"{50}"}&gt;
    &lt;div&gt;Right content&lt;/div&gt;
  &lt;/ResizablePane&gt;
&lt;/ResizablePaneGroup&gt;</code></pre>
				</div>

				<div>
					<h4 class="text-fluid-base font-semibold mb-2">Vertical Split</h4>
					<pre
						class="bg-muted/5 p-3 rounded text-fluid-sm overflow-x-auto"><code>&lt;ResizablePaneGroup direction="vertical"&gt;
  &lt;ResizablePane defaultSize={"{60}"}&gt;
    &lt;div&gt;Top content&lt;/div&gt;
  &lt;/ResizablePane&gt;

  &lt;ResizableHandle withHandle={"{true}"} /&gt;

  &lt;ResizablePane defaultSize={"{40}"}&gt;
    &lt;div&gt;Bottom content&lt;/div&gt;
  &lt;/ResizablePane&gt;
&lt;/ResizablePaneGroup&gt;</code></pre>
				</div>
			</div>
		</Card>
	</section>

	<!-- Props Reference -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Component Props</h2>

		<div class="grid grid-cols-1 lg:grid-cols-3 gap-fluid-4">
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">ResizablePaneGroup</h3>
				{/snippet}

				<div class="space-y-2 text-fluid-sm">
					<div>
						<code class="bg-muted/10 px-1 rounded">direction</code>
						<p class="text-muted">'horizontal' | 'vertical'</p>
						<p class="text-xs text-muted">Default: 'horizontal'</p>
					</div>
					<div>
						<code class="bg-muted/10 px-1 rounded">class</code>
						<p class="text-muted">Additional CSS classes</p>
					</div>
				</div>
			</Card>

			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">ResizablePane</h3>
				{/snippet}

				<div class="space-y-2 text-fluid-sm">
					<div>
						<code class="bg-muted/10 px-1 rounded">defaultSize</code>
						<p class="text-muted">Initial size percentage (0-100)</p>
						<p class="text-xs text-muted">Default: 50</p>
					</div>
					<div>
						<code class="bg-muted/10 px-1 rounded">minSize</code>
						<p class="text-muted">Minimum size percentage</p>
						<p class="text-xs text-muted">Default: 10</p>
					</div>
					<div>
						<code class="bg-muted/10 px-1 rounded">maxSize</code>
						<p class="text-muted">Maximum size percentage</p>
						<p class="text-xs text-muted">Default: 90</p>
					</div>
					<div>
						<code class="bg-muted/10 px-1 rounded">collapsible</code>
						<p class="text-muted">Allow pane to collapse to 0</p>
						<p class="text-xs text-muted">Default: false</p>
					</div>
				</div>
			</Card>

			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">ResizableHandle</h3>
				{/snippet}

				<div class="space-y-2 text-fluid-sm">
					<div>
						<code class="bg-muted/10 px-1 rounded">withHandle</code>
						<p class="text-muted">Show visual grip indicator</p>
						<p class="text-xs text-muted">Default: false</p>
					</div>
					<div>
						<code class="bg-muted/10 px-1 rounded">class</code>
						<p class="text-muted">Additional CSS classes</p>
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
						<li>Arrow Left/Right for horizontal resizing (5% per keystroke)</li>
						<li>Arrow Up/Down for vertical resizing (5% per keystroke)</li>
					</ul>
				</div>

				<div>
					<h4 class="text-fluid-base font-semibold mb-2">ARIA Attributes</h4>
					<ul class="list-disc list-inside text-fluid-sm text-muted space-y-1">
						<li><code class="bg-muted/10 px-1 rounded">role="separator"</code> on resize handles</li>
						<li>
							<code class="bg-muted/10 px-1 rounded">aria-orientation</code> indicates split direction
						</li>
						<li>Handles are focusable with <code class="bg-muted/10 px-1 rounded">tabindex="0"</code></li>
					</ul>
				</div>

				<div>
					<h4 class="text-fluid-base font-semibold mb-2">Visual Feedback</h4>
					<ul class="list-disc list-inside text-fluid-sm text-muted space-y-1">
						<li>Cursor changes to indicate resize direction</li>
						<li>Hover state highlights the handle</li>
						<li>Active state provides visual feedback during drag</li>
						<li>Focus ring visible for keyboard navigation</li>
					</ul>
				</div>
			</div>
		</Card>
	</section>

	<!-- Design Tokens -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Design Tokens</h2>

		<Card>
			<div class="overflow-x-auto">
				<table class="w-full text-left text-fluid-sm">
					<thead class="border-b border-border">
						<tr>
							<th class="py-2 px-3 font-semibold">Element</th>
							<th class="py-2 px-3 font-semibold">Default Style</th>
							<th class="py-2 px-3 font-semibold">Hover</th>
							<th class="py-2 px-3 font-semibold">Active</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						<tr>
							<td class="py-2 px-3">Handle Background</td>
							<td class="py-2 px-3"><code>bg-border</code></td>
							<td class="py-2 px-3"><code>bg-primary/50</code></td>
							<td class="py-2 px-3"><code>bg-primary</code></td>
						</tr>
						<tr>
							<td class="py-2 px-3">Handle Size (horizontal)</td>
							<td class="py-2 px-3"><code>w-1 h-full</code></td>
							<td class="py-2 px-3">-</td>
							<td class="py-2 px-3">-</td>
						</tr>
						<tr>
							<td class="py-2 px-3">Handle Size (vertical)</td>
							<td class="py-2 px-3"><code>h-1 w-full</code></td>
							<td class="py-2 px-3">-</td>
							<td class="py-2 px-3">-</td>
						</tr>
						<tr>
							<td class="py-2 px-3">Transition</td>
							<td class="py-2 px-3" colspan="3"><code>duration-fast</code> (150ms)</td>
						</tr>
					</tbody>
				</table>
			</div>
		</Card>
	</section>

	<!-- Technical Notes -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Implementation Notes</h2>

		<Card>
			<div class="space-y-fluid-3 text-fluid-sm">
				<div>
					<h4 class="text-fluid-base font-semibold mb-2">Current Limitations</h4>
					<ul class="list-disc list-inside text-muted space-y-1">
						<li>
							This is a visual-only implementation. The drag handlers log deltas to the console but
							don't update pane sizes.
						</li>
						<li>
							A complete implementation would require state management in the PaneGroup to
							coordinate resize events.
						</li>
						<li>
							Consider integrating <code class="bg-muted/10 px-1 rounded">paneforge</code> or similar
							library for production use.
						</li>
					</ul>
				</div>

				<div>
					<h4 class="text-fluid-base font-semibold mb-2">Future Enhancements</h4>
					<ul class="list-disc list-inside text-muted space-y-1">
						<li>Persist resize state to localStorage</li>
						<li>Support for collapse/expand animations</li>
						<li>Touch/mobile gesture support</li>
						<li>Double-click to reset to default size</li>
					</ul>
				</div>

				<div>
					<h4 class="text-fluid-base font-semibold mb-2">Component Structure</h4>
					<ul class="list-disc list-inside text-muted space-y-1">
						<li>Uses CVA (class-variance-authority) for variant management</li>
						<li>Follows Svelte 5 patterns with $props() and $state()</li>
						<li>Context API passes direction from PaneGroup to Handle</li>
						<li>Fully typed with TypeScript interfaces</li>
					</ul>
				</div>
			</div>
		</Card>
	</section>
</div>
