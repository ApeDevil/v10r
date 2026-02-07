<script lang="ts">
	import { PageHeader, Card } from '$lib/components';
	import { ContextMenu } from '$lib/components/composites/context-menu';

	// Simple items example
	const simpleItems = [
		{ label: 'View Details', icon: 'i-lucide-eye', onclick: () => alert('View clicked') },
		{ label: 'Edit', icon: 'i-lucide-pencil', shortcut: '⌘E', onclick: () => alert('Edit clicked') },
		{ separator: true },
		{ label: 'Delete', icon: 'i-lucide-trash-2', shortcut: '⌘⌫', onclick: () => alert('Delete clicked') }
	];

	// Document actions
	const documentItems = [
		{ label: 'New Document', icon: 'i-lucide-file-plus', shortcut: '⌘N', onclick: () => alert('New document') },
		{ label: 'Open...', icon: 'i-lucide-folder-open', shortcut: '⌘O', onclick: () => alert('Open') },
		{ separator: true },
		{ label: 'Save', icon: 'i-lucide-save', shortcut: '⌘S', onclick: () => alert('Saved') },
		{ label: 'Save As...', icon: 'i-lucide-save-all', shortcut: '⇧⌘S', onclick: () => alert('Save as') },
		{ separator: true },
		{ label: 'Export PDF', icon: 'i-lucide-file-down', onclick: () => alert('Exporting PDF') },
		{ label: 'Print', icon: 'i-lucide-printer', shortcut: '⌘P', onclick: () => alert('Printing') }
	];

	// Disabled items example
	const itemsWithDisabled = [
		{ label: 'Cut', icon: 'i-lucide-scissors', shortcut: '⌘X', disabled: true, onclick: () => {} },
		{ label: 'Copy', icon: 'i-lucide-copy', shortcut: '⌘C', onclick: () => alert('Copied') },
		{ label: 'Paste', icon: 'i-lucide-clipboard', shortcut: '⌘V', onclick: () => alert('Pasted') },
		{ separator: true },
		{ label: 'Select All', icon: 'i-lucide-select-all', shortcut: '⌘A', onclick: () => alert('Selected all') }
	];

	// Image actions
	const imageItems = [
		{ label: 'Open Image', icon: 'i-lucide-image', onclick: () => alert('Opening image') },
		{ label: 'Save Image As...', icon: 'i-lucide-download', onclick: () => alert('Saving image') },
		{ separator: true },
		{ label: 'Copy Image', icon: 'i-lucide-copy', onclick: () => alert('Image copied') },
		{ label: 'Copy Image Address', icon: 'i-lucide-link', onclick: () => alert('Address copied') }
	];
</script>

<PageHeader
	title="ContextMenu Component"
	description="Right-click context menus with keyboard navigation, icons, and shortcuts."
/>

<div class="max-w-layout-narrow mx-auto space-y-fluid-6 p-fluid-4">
	<!-- Basic Example -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Basic Context Menu</h2>
		<p class="text-fluid-base text-muted mb-fluid-4">
			Right-click the card below to open a simple context menu.
		</p>

		<ContextMenu items={simpleItems}>
			{#snippet trigger({ props })}
				<Card>
					<div class="flex items-center justify-center h-40" {...props}>
						<div class="text-center">
							<p class="text-fluid-lg font-semibold mb-2">Right-click me</p>
							<p class="text-fluid-sm text-muted">Open context menu with common actions</p>
						</div>
					</div>
				</Card>
			{/snippet}
		</ContextMenu>
	</section>

	<!-- Document Actions -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Document Actions</h2>
		<p class="text-fluid-base text-muted mb-fluid-4">
			Comprehensive menu with file operations, keyboard shortcuts, and visual separators.
		</p>

		<ContextMenu items={documentItems}>
			{#snippet trigger({ props })}
				<Card>
					<div class="p-fluid-4 min-h-48" {...props}>
						<h3 class="text-fluid-lg font-semibold mb-2">Document.txt</h3>
						<p class="text-fluid-base text-muted leading-relaxed">
							Right-click anywhere in this document area to access file operations. Notice the
							keyboard shortcuts displayed next to each action.
						</p>
						<p class="text-fluid-base text-muted leading-relaxed mt-4">
							The menu is organized with separators grouping related actions: file management,
							save options, and export/print functions.
						</p>
					</div>
				</Card>
			{/snippet}
		</ContextMenu>
	</section>

	<!-- Disabled Items -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Disabled States</h2>
		<p class="text-fluid-base text-muted mb-fluid-4">
			Context menu with disabled items (Cut is disabled when no text is selected).
		</p>

		<ContextMenu items={itemsWithDisabled}>
			{#snippet trigger({ props })}
				<Card>
					<div class="flex items-center justify-center h-32" {...props}>
						<div class="text-center">
							<p class="text-fluid-base text-muted">Right-click to see clipboard actions</p>
							<p class="text-fluid-sm text-muted mt-1">(Cut is disabled)</p>
						</div>
					</div>
				</Card>
			{/snippet}
		</ContextMenu>
	</section>

	<!-- Image Context Menu -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Image Actions</h2>
		<p class="text-fluid-base text-muted mb-fluid-4">
			Browser-style image context menu.
		</p>

		<ContextMenu items={imageItems}>
			{#snippet trigger({ props })}
				<div
					class="flex items-center justify-center h-64 bg-gradient-to-br from-primary/20 to-success/20 rounded-lg border border-border"
					{...props}
				>
					<div class="text-center">
						<span class="i-lucide-image text-6xl text-primary mb-3 block"></span>
						<p class="text-fluid-base text-muted">Right-click this image placeholder</p>
					</div>
				</div>
			{/snippet}
		</ContextMenu>
	</section>

	<!-- Features -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Features</h2>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-fluid-4">
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">Keyboard Navigation</h3>
				{/snippet}
				<ul class="text-fluid-sm text-muted space-y-2">
					<li class="flex gap-2">
						<span class="i-lucide-check text-success"></span>
						<span>Arrow keys to navigate items</span>
					</li>
					<li class="flex gap-2">
						<span class="i-lucide-check text-success"></span>
						<span>Enter/Space to activate</span>
					</li>
					<li class="flex gap-2">
						<span class="i-lucide-check text-success"></span>
						<span>Escape to close</span>
					</li>
					<li class="flex gap-2">
						<span class="i-lucide-check text-success"></span>
						<span>Type to jump to item (typeahead)</span>
					</li>
				</ul>
			</Card>

			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">Visual Design</h3>
				{/snippet}
				<ul class="text-fluid-sm text-muted space-y-2">
					<li class="flex gap-2">
						<span class="i-lucide-check text-success"></span>
						<span>Icons with consistent sizing</span>
					</li>
					<li class="flex gap-2">
						<span class="i-lucide-check text-success"></span>
						<span>Keyboard shortcuts aligned right</span>
					</li>
					<li class="flex gap-2">
						<span class="i-lucide-check text-success"></span>
						<span>Hover states and focus indicators</span>
					</li>
					<li class="flex gap-2">
						<span class="i-lucide-check text-success"></span>
						<span>Disabled state styling</span>
					</li>
				</ul>
			</Card>

			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">Accessibility</h3>
				{/snippet}
				<ul class="text-fluid-sm text-muted space-y-2">
					<li class="flex gap-2">
						<span class="i-lucide-check text-success"></span>
						<span>ARIA attributes from Bits UI</span>
					</li>
					<li class="flex gap-2">
						<span class="i-lucide-check text-success"></span>
						<span>Focus management</span>
					</li>
					<li class="flex gap-2">
						<span class="i-lucide-check text-success"></span>
						<span>Disabled items properly marked</span>
					</li>
					<li class="flex gap-2">
						<span class="i-lucide-check text-success"></span>
						<span>Screen reader compatible</span>
					</li>
				</ul>
			</Card>

			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">Developer Experience</h3>
				{/snippet}
				<ul class="text-fluid-sm text-muted space-y-2">
					<li class="flex gap-2">
						<span class="i-lucide-check text-success"></span>
						<span>Simple array-based API</span>
					</li>
					<li class="flex gap-2">
						<span class="i-lucide-check text-success"></span>
						<span>TypeScript support</span>
					</li>
					<li class="flex gap-2">
						<span class="i-lucide-check text-success"></span>
						<span>Snippet-based trigger</span>
					</li>
					<li class="flex gap-2">
						<span class="i-lucide-check text-success"></span>
						<span>Consistent with DropdownMenu</span>
					</li>
				</ul>
			</Card>
		</div>
	</section>

	<!-- Usage Example -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Usage</h2>

		<Card>
			<div class="space-y-fluid-4">
				<div>
					<h4 class="text-fluid-base font-semibold mb-2">Import</h4>
					<pre
						class="bg-muted/5 p-3 rounded text-fluid-sm overflow-x-auto"><code>import {'{'} ContextMenu {'}'} from '$lib/components/composites/context-menu';</code></pre>
				</div>

				<div>
					<h4 class="text-fluid-base font-semibold mb-2">Define Items</h4>
					<pre class="bg-muted/5 p-3 rounded text-fluid-sm overflow-x-auto"><code>const items = [
  {'{'} label: 'Edit', icon: 'i-lucide-pencil', shortcut: '⌘E', onclick: () => {'{'} /* action */ {'}'} {'}'},
  {'{'} separator: true {'}'},
  {'{'} label: 'Delete', icon: 'i-lucide-trash-2', onclick: () => {'{'} /* action */ {'}'} {'}'}
];</code></pre>
				</div>

				<div>
					<h4 class="text-fluid-base font-semibold mb-2">Render Component</h4>
					<pre class="bg-muted/5 p-3 rounded text-fluid-sm overflow-x-auto"><code>&lt;ContextMenu items={'{items}'}&gt;
  {'{'#snippet trigger({'{'} props {'}'}){'}'}}
    &lt;div {'{...props}'}&gt;Right-click me&lt;/div&gt;
  {'{/snippet}'}
&lt;/ContextMenu&gt;</code></pre>
				</div>
			</div>
		</Card>
	</section>

	<!-- API Reference -->
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">API Reference</h2>

		<Card>
			<div class="overflow-x-auto">
				<table class="w-full text-left text-fluid-sm">
					<thead class="border-b border-border">
						<tr>
							<th class="py-2 px-3 font-semibold">Prop</th>
							<th class="py-2 px-3 font-semibold">Type</th>
							<th class="py-2 px-3 font-semibold">Default</th>
							<th class="py-2 px-3 font-semibold">Description</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						<tr>
							<td class="py-2 px-3"><code>items</code></td>
							<td class="py-2 px-3"><code>ContextMenuItem[]</code></td>
							<td class="py-2 px-3">-</td>
							<td class="py-2 px-3">Array of menu items</td>
						</tr>
						<tr>
							<td class="py-2 px-3"><code>trigger</code></td>
							<td class="py-2 px-3"><code>Snippet</code></td>
							<td class="py-2 px-3">-</td>
							<td class="py-2 px-3">Right-click target area</td>
						</tr>
						<tr>
							<td class="py-2 px-3"><code>align</code></td>
							<td class="py-2 px-3"><code>'start' | 'center' | 'end'</code></td>
							<td class="py-2 px-3"><code>'start'</code></td>
							<td class="py-2 px-3">Menu alignment</td>
						</tr>
					</tbody>
				</table>
			</div>

			<div class="mt-fluid-4">
				<h4 class="text-fluid-base font-semibold mb-2">ContextMenuItem Interface</h4>
				<pre class="bg-muted/5 p-3 rounded text-fluid-sm overflow-x-auto"><code>interface ContextMenuItem {'{'}
  label: string;              // Item text
  icon?: string;              // CSS icon class (e.g., 'i-lucide-home')
  shortcut?: string;          // Keyboard shortcut display
  onclick?: () => void;       // Click handler
  separator?: boolean;        // Render as separator
  disabled?: boolean;         // Disable interaction
{'}'}</code></pre>
			</div>
		</Card>
	</section>
</div>
