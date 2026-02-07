<script lang="ts">
	import { MenuBar, type MenuBarMenu } from '$lib/components/composites';

	let showLineNumbers = $state(false);
	let wordWrap = $state(true);

	const menus: MenuBarMenu[] = [
		{
			label: 'File',
			items: [
				{
					type: 'item',
					label: 'New File',
					icon: 'i-lucide-file-plus',
					shortcut: 'Ctrl+N',
					onSelect: () => console.log('New File')
				},
				{
					type: 'item',
					label: 'Open',
					icon: 'i-lucide-folder-open',
					shortcut: 'Ctrl+O',
					onSelect: () => console.log('Open')
				},
				{ type: 'separator' },
				{
					type: 'item',
					label: 'Save',
					icon: 'i-lucide-save',
					shortcut: 'Ctrl+S',
					onSelect: () => console.log('Save')
				},
				{
					type: 'item',
					label: 'Save As...',
					icon: 'i-lucide-save',
					shortcut: 'Ctrl+⇧+S',
					onSelect: () => console.log('Save As')
				},
				{ type: 'separator' },
				{
					type: 'item',
					label: 'Close',
					shortcut: 'Ctrl+W',
					onSelect: () => console.log('Close')
				}
			]
		},
		{
			label: 'Edit',
			items: [
				{
					type: 'item',
					label: 'Undo',
					icon: 'i-lucide-undo',
					shortcut: 'Ctrl+Z',
					onSelect: () => console.log('Undo')
				},
				{
					type: 'item',
					label: 'Redo',
					icon: 'i-lucide-redo',
					shortcut: 'Ctrl+⇧+Z',
					onSelect: () => console.log('Redo')
				},
				{ type: 'separator' },
				{
					type: 'item',
					label: 'Cut',
					icon: 'i-lucide-scissors',
					shortcut: 'Ctrl+X',
					onSelect: () => console.log('Cut')
				},
				{
					type: 'item',
					label: 'Copy',
					icon: 'i-lucide-copy',
					shortcut: 'Ctrl+C',
					onSelect: () => console.log('Copy')
				},
				{
					type: 'item',
					label: 'Paste',
					icon: 'i-lucide-clipboard',
					shortcut: 'Ctrl+V',
					onSelect: () => console.log('Paste')
				}
			]
		},
		{
			label: 'View',
			items: [
				{
					type: 'checkbox',
					label: 'Show Line Numbers',
					checked: showLineNumbers,
					onSelect: () => {
						showLineNumbers = !showLineNumbers;
						console.log('Line Numbers:', showLineNumbers);
					}
				},
				{
					type: 'checkbox',
					label: 'Word Wrap',
					checked: wordWrap,
					onSelect: () => {
						wordWrap = !wordWrap;
						console.log('Word Wrap:', wordWrap);
					}
				},
				{ type: 'separator' },
				{
					type: 'item',
					label: 'Zoom In',
					icon: 'i-lucide-zoom-in',
					shortcut: 'Ctrl++',
					onSelect: () => console.log('Zoom In')
				},
				{
					type: 'item',
					label: 'Zoom Out',
					icon: 'i-lucide-zoom-out',
					shortcut: 'Ctrl+-',
					onSelect: () => console.log('Zoom Out')
				},
				{
					type: 'item',
					label: 'Reset Zoom',
					shortcut: 'Ctrl+0',
					onSelect: () => console.log('Reset Zoom')
				}
			]
		},
		{
			label: 'Help',
			items: [
				{
					type: 'item',
					label: 'Documentation',
					icon: 'i-lucide-book-open',
					onSelect: () => console.log('Documentation')
				},
				{
					type: 'item',
					label: 'Keyboard Shortcuts',
					icon: 'i-lucide-keyboard',
					shortcut: 'Ctrl+/',
					onSelect: () => console.log('Shortcuts')
				},
				{ type: 'separator' },
				{
					type: 'item',
					label: 'About',
					icon: 'i-lucide-info',
					onSelect: () => console.log('About')
				}
			]
		}
	];
</script>

<div class="container mx-auto p-8 space-y-8">
	<div class="space-y-2">
		<h1 class="text-fluid-4xl font-bold">MenuBar Component</h1>
		<p class="text-fluid-lg text-muted">
			A horizontal menu bar with keyboard navigation, like application menus (File, Edit, View,
			etc.)
		</p>
	</div>

	<section class="space-y-4">
		<h2 class="text-fluid-2xl font-semibold">Example</h2>
		<div class="border border-border rounded-lg overflow-hidden">
			<MenuBar {menus} />
			<div class="p-8 bg-surface-1">
				<h3 class="text-fluid-xl font-medium mb-4">Content Area</h3>
				<p class="text-muted mb-4">
					Open the console to see menu actions. Try using arrow keys to navigate between menus and
					items.
				</p>
				<div class="space-y-2 text-fluid-sm">
					<p>
						<strong>Line Numbers:</strong>
						{showLineNumbers ? 'Enabled' : 'Disabled'}
					</p>
					<p>
						<strong>Word Wrap:</strong>
						{wordWrap ? 'Enabled' : 'Disabled'}
					</p>
				</div>
			</div>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-fluid-2xl font-semibold">Features</h2>
		<ul class="list-disc list-inside space-y-2 text-muted">
			<li>Data-driven API with array of menus and items</li>
			<li>Support for regular items, separators, and checkbox items</li>
			<li>Optional icons using UnoCSS icon classes (e.g., i-lucide-copy)</li>
			<li>Keyboard shortcuts displayed with muted text</li>
			<li>Full keyboard navigation (arrow keys, enter, escape)</li>
			<li>Dark theme with surface-2 background and border styling</li>
			<li>Disabled state support for items</li>
			<li>Hover and focus states with smooth transitions</li>
		</ul>
	</section>

	<section class="space-y-4">
		<h2 class="text-fluid-2xl font-semibold">Usage</h2>
		<pre
			class="bg-surface-3 border border-border rounded-lg p-4 overflow-x-auto text-fluid-sm"><code
>{`<script lang="ts">
  import { MenuBar, type MenuBarMenu } from '$lib/components/composites';

  let showLineNumbers = $state(false);

  const menus: MenuBarMenu[] = [
    {
      label: 'File',
      items: [
        {
          type: 'item',
          label: 'New File',
          icon: 'i-lucide-file-plus',
          shortcut: 'Ctrl+N',
          onSelect: () => console.log('New File')
        },
        { type: 'separator' },
        {
          type: 'item',
          label: 'Save',
          icon: 'i-lucide-save',
          shortcut: 'Ctrl+S',
          onSelect: () => console.log('Save')
        }
      ]
    },
    {
      label: 'View',
      items: [
        {
          type: 'checkbox',
          label: 'Show Line Numbers',
          checked: showLineNumbers,
          onSelect: () => {
            showLineNumbers = !showLineNumbers;
          }
        }
      ]
    }
  ];
</script>

<MenuBar {menus} />`}</code></pre>
	</section>
</div>
