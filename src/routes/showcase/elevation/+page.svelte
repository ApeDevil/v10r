<script lang="ts">
	import { PageHeader, Card, Dialog, Popover, Tooltip } from '$lib/components';

	// Dialog state
	let dialogOpen = $state(false);

	// Popover state
	let popoverOpen = $state(false);

	// Theme toggle for demonstration
	let isDark = $state(false);

	function toggleTheme() {
		isDark = !isDark;
		document.documentElement.classList.toggle('dark');
	}
</script>

<PageHeader
	title="Elevation System"
	description="Visual depth through inverse elevation. Higher z-index → white in light mode, complete dark in dark mode."
/>

<div class="max-w-layout-narrow mx-auto space-y-fluid-6 p-fluid-4">
	<!-- Theme Toggle -->
	<div class="flex items-center justify-between">
		<p class="text-fluid-base text-muted">
			Current theme: <strong class="text-fg">{isDark ? 'Dark' : 'Light'}</strong>
		</p>
		<button
			onclick={toggleTheme}
			class="px-4 py-2 rounded-md bg-primary text-white hover:bg-primary-hover transition-colors duration-fast"
		>
			Toggle Theme
		</button>
	</div>

	<!-- Surface Progression Demo -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Surface Progression</h2>
		<p class="text-fluid-base text-muted mb-fluid-4">
			4 elevation levels. Light mode: higher = whiter. Dark mode: higher = darker.
		</p>

		<div class="space-y-fluid-3">
			<!-- Surface 0 (Base) -->
			<div class="bg-surface-0 rounded-lg p-fluid-4 border border-border">
				<div class="flex items-center justify-between">
					<div>
						<h3 class="text-fluid-lg font-semibold">Surface 0 (Base)</h3>
						<p class="text-fluid-sm text-muted">Page background • Same as --color-bg</p>
					</div>
					<code class="text-fluid-xs bg-muted/10 px-2 py-1 rounded">bg-surface-0</code>
				</div>
			</div>

			<!-- Surface 1 (Raised) -->
			<div class="bg-surface-1 rounded-lg p-fluid-4 border border-border shadow-sm">
				<div class="flex items-center justify-between">
					<div>
						<h3 class="text-fluid-lg font-semibold">Surface 1 (Raised)</h3>
						<p class="text-fluid-sm text-muted">Cards, panels, sidebar</p>
					</div>
					<code class="text-fluid-xs bg-muted/10 px-2 py-1 rounded">bg-surface-1</code>
				</div>
			</div>

			<!-- Surface 2 (Overlay) -->
			<div class="bg-surface-2 rounded-lg p-fluid-4 border border-border shadow-md">
				<div class="flex items-center justify-between">
					<div>
						<h3 class="text-fluid-lg font-semibold">Surface 2 (Overlay)</h3>
						<p class="text-fluid-sm text-muted">Dropdowns, popovers, drawers</p>
					</div>
					<code class="text-fluid-xs bg-muted/10 px-2 py-1 rounded">bg-surface-2</code>
				</div>
			</div>

			<!-- Surface 3 (Modal) -->
			<div class="bg-surface-3 rounded-lg p-fluid-4 border border-border shadow-xl">
				<div class="flex items-center justify-between">
					<div>
						<h3 class="text-fluid-lg font-semibold">Surface 3 (Modal)</h3>
						<p class="text-fluid-sm text-muted">Modals, tooltips • Highest elevation</p>
					</div>
					<code class="text-fluid-xs bg-muted/10 px-2 py-1 rounded">bg-surface-3</code>
				</div>
			</div>
		</div>
	</section>

	<!-- Interactive Components Demo -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Interactive Components</h2>
		<p class="text-fluid-base text-muted mb-fluid-4">
			Real components automatically use the correct elevation surfaces.
		</p>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-fluid-4">
			<!-- Card Example -->
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">Card Component</h3>
				{/snippet}

				<p class="text-fluid-sm text-muted">
					Cards use <code class="bg-muted/10 px-1 rounded">bg-surface-1</code> automatically.
				</p>
			</Card>

			<!-- Dialog Trigger -->
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">Dialog Component</h3>
				{/snippet}

				<p class="text-fluid-sm text-muted mb-fluid-3">
					Dialogs use <code class="bg-muted/10 px-1 rounded">bg-surface-3</code> for maximum
					elevation.
				</p>

				<button
					onclick={() => (dialogOpen = true)}
					class="px-4 py-2 rounded-md bg-primary text-white hover:bg-primary-hover transition-colors duration-fast"
				>
					Open Dialog
				</button>
			</Card>

			<!-- Popover Trigger -->
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">Popover Component</h3>
				{/snippet}

				<p class="text-fluid-sm text-muted mb-fluid-3">
					Popovers use <code class="bg-muted/10 px-1 rounded">bg-surface-2</code> for mid-level
					elevation.
				</p>

				<Popover bind:open={popoverOpen}>
					{#snippet trigger()}
						<button
							class="px-4 py-2 rounded-md bg-primary text-white hover:bg-primary-hover transition-colors duration-fast"
						>
							Open Popover
						</button>
					{/snippet}

					{#snippet content()}
						<h4 class="text-fluid-base font-semibold mb-2">Popover Content</h4>
						<p class="text-fluid-sm text-muted">
							This popover uses <code class="bg-muted/10 px-1 rounded">bg-surface-2</code>.
						</p>
					{/snippet}
				</Popover>
			</Card>

			<!-- Tooltip Example -->
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">Tooltip Component</h3>
				{/snippet}

				<p class="text-fluid-sm text-muted mb-fluid-3">
					Tooltips use <code class="bg-muted/10 px-1 rounded">bg-surface-3</code> for highest
					elevation.
				</p>

				<Tooltip content="This tooltip uses surface-3 for maximum elevation">
					<button
						class="px-4 py-2 rounded-md bg-primary text-white hover:bg-primary-hover transition-colors duration-fast"
					>
						Hover for Tooltip
					</button>
				</Tooltip>
			</Card>
		</div>
	</section>

	<!-- Stacking Context Demo -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Stacking Context</h2>
		<p class="text-fluid-base text-muted mb-fluid-4">
			Multiple elevation layers overlapping to show visual hierarchy.
		</p>

		<div class="relative h-80 bg-surface-0 rounded-lg border border-border overflow-hidden">
			<!-- Layer 0: Base -->
			<div
				class="absolute inset-0 flex items-center justify-center text-fluid-3xl font-bold text-muted/20"
			>
				Surface 0
			</div>

			<!-- Layer 1: Raised Card -->
			<div
				class="absolute top-8 left-8 w-56 bg-surface-1 rounded-lg p-4 border border-border shadow-sm"
			>
				<h4 class="text-fluid-lg font-semibold mb-1">Surface 1</h4>
				<p class="text-fluid-sm text-muted">Cards, panels</p>
			</div>

			<!-- Layer 2: Overlay -->
			<div
				class="absolute top-20 left-20 w-56 bg-surface-2 rounded-lg p-4 border border-border shadow-md"
			>
				<h4 class="text-fluid-lg font-semibold mb-1">Surface 2</h4>
				<p class="text-fluid-sm text-muted">Dropdowns, popovers</p>
			</div>

			<!-- Layer 3: Modal -->
			<div
				class="absolute top-32 left-32 w-56 bg-surface-3 rounded-lg p-4 border border-border shadow-xl"
			>
				<h4 class="text-fluid-lg font-semibold mb-1">Surface 3</h4>
				<p class="text-fluid-sm text-muted">Modals, tooltips</p>
			</div>
		</div>
	</section>

	<!-- Design Tokens Reference -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Design Tokens</h2>

		<Card>
			<div class="overflow-x-auto">
				<table class="w-full text-left text-fluid-sm">
					<thead class="border-b border-border">
						<tr>
							<th class="py-2 px-3 font-semibold">CSS Variable</th>
							<th class="py-2 px-3 font-semibold">UnoCSS Class</th>
							<th class="py-2 px-3 font-semibold">Light Mode</th>
							<th class="py-2 px-3 font-semibold">Dark Mode</th>
							<th class="py-2 px-3 font-semibold">Usage</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						<tr>
							<td class="py-2 px-3"><code>--surface-0</code></td>
							<td class="py-2 px-3"><code>bg-surface-0</code></td>
							<td class="py-2 px-3">= --color-bg</td>
							<td class="py-2 px-3">= --color-bg</td>
							<td class="py-2 px-3">Page background</td>
						</tr>
						<tr>
							<td class="py-2 px-3"><code>--surface-1</code></td>
							<td class="py-2 px-3"><code>bg-surface-1</code></td>
							<td class="py-2 px-3">Lighter</td>
							<td class="py-2 px-3">Darker</td>
							<td class="py-2 px-3">Cards, sidebar</td>
						</tr>
						<tr>
							<td class="py-2 px-3"><code>--surface-2</code></td>
							<td class="py-2 px-3"><code>bg-surface-2</code></td>
							<td class="py-2 px-3">Lighter still</td>
							<td class="py-2 px-3">Darker still</td>
							<td class="py-2 px-3">Dropdowns, popovers</td>
						</tr>
						<tr>
							<td class="py-2 px-3"><code>--surface-3</code></td>
							<td class="py-2 px-3"><code>bg-surface-3</code></td>
							<td class="py-2 px-3">#ffffff (white)</td>
							<td class="py-2 px-3">#000000 (black)</td>
							<td class="py-2 px-3">Modals, tooltips</td>
						</tr>
					</tbody>
				</table>
			</div>
		</Card>
	</section>

	<!-- Implementation Guide -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Implementation</h2>

		<Card>
			<div class="space-y-fluid-3">
				<div>
					<h4 class="text-fluid-base font-semibold mb-2">Option 1: Semantic Components</h4>
					<pre
						class="bg-muted/5 p-3 rounded text-fluid-sm overflow-x-auto"><code>&lt;Card&gt;Uses bg-surface-1&lt;/Card&gt;
&lt;Dialog&gt;Uses bg-surface-3&lt;/Dialog&gt;</code></pre>
				</div>

				<div>
					<h4 class="text-fluid-base font-semibold mb-2">Option 2: UnoCSS Classes</h4>
					<pre
						class="bg-muted/5 p-3 rounded text-fluid-sm overflow-x-auto"><code>&lt;div class="bg-surface-1 rounded-lg p-4"&gt;
  Custom card
&lt;/div&gt;</code></pre>
				</div>

				<div>
					<h4 class="text-fluid-base font-semibold mb-2">Option 3: CSS Variables</h4>
					<pre
						class="bg-muted/5 p-3 rounded text-fluid-sm overflow-x-auto"><code>&lt;div style:background="var(--surface-2)"&gt;
  Custom floating element
&lt;/div&gt;</code></pre>
				</div>
			</div>
		</Card>
	</section>
</div>

<!-- Dialog Component -->
<Dialog bind:open={dialogOpen} title="Dialog Example">
	<p class="text-fluid-base text-muted mb-fluid-4">
		This dialog uses <code class="bg-muted/10 px-1 rounded">bg-surface-3</code> — the highest
		elevation. In light mode this is pure white, in dark mode it's complete black.
	</p>

	<div class="mt-fluid-4 flex justify-end gap-2">
		<button
			onclick={() => (dialogOpen = false)}
			class="px-4 py-2 rounded-md bg-muted/10 hover:bg-muted/20 transition-colors duration-fast"
		>
			Close
		</button>
		<button
			onclick={() => (dialogOpen = false)}
			class="px-4 py-2 rounded-md bg-primary text-white hover:bg-primary-hover transition-colors duration-fast"
		>
			Got it
		</button>
	</div>
</Dialog>
