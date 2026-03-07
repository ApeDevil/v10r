<script lang="ts">
	import { DemoCard } from '../../components/_components';
	import { MenuBar } from '$lib/components/composites';
	import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';

	let wordWrap = $state(true);
	let minimap = $state(false);
	let lineNumbers = $state(true);

	let editorMenus: MenuBarMenu[] = $derived([
		{
			label: 'File',
			items: [
				{ label: 'New File', shortcut: 'Ctrl+N', onSelect: () => {} },
				{ label: 'Open File', shortcut: 'Ctrl+O', onSelect: () => {} },
				{ label: 'Open Folder', onSelect: () => {} },
				{ type: 'separator' },
				{ label: 'Save', shortcut: 'Ctrl+S', onSelect: () => {} },
				{ label: 'Save As...', shortcut: 'Ctrl+Shift+S', onSelect: () => {} },
				{ type: 'separator' },
				{ label: 'Close Editor', shortcut: 'Ctrl+W', onSelect: () => {} },
			],
		},
		{
			label: 'Edit',
			items: [
				{ label: 'Undo', shortcut: 'Ctrl+Z', onSelect: () => {} },
				{ label: 'Redo', shortcut: 'Ctrl+Shift+Z', onSelect: () => {} },
				{ type: 'separator' },
				{ label: 'Cut', shortcut: 'Ctrl+X', onSelect: () => {} },
				{ label: 'Copy', shortcut: 'Ctrl+C', onSelect: () => {} },
				{ label: 'Paste', shortcut: 'Ctrl+V', onSelect: () => {} },
				{ type: 'separator' },
				{ label: 'Find', shortcut: 'Ctrl+F', onSelect: () => {} },
				{ label: 'Replace', shortcut: 'Ctrl+H', onSelect: () => {} },
			],
		},
		{
			label: 'View',
			items: [
				{ label: 'Word Wrap', type: 'checkbox', checked: wordWrap, onSelect: () => { wordWrap = !wordWrap; } },
				{ label: 'Minimap', type: 'checkbox', checked: minimap, onSelect: () => { minimap = !minimap; } },
				{ label: 'Line Numbers', type: 'checkbox', checked: lineNumbers, onSelect: () => { lineNumbers = !lineNumbers; } },
				{ type: 'separator' },
				{ label: 'Zoom In', shortcut: 'Ctrl++', onSelect: () => {} },
				{ label: 'Zoom Out', shortcut: 'Ctrl+-', onSelect: () => {} },
				{ label: 'Reset Zoom', shortcut: 'Ctrl+0', onSelect: () => {} },
			],
		},
		{
			label: 'Help',
			items: [
				{ label: 'Documentation', icon: 'i-lucide-book-open', onSelect: () => {} },
				{ label: 'Keyboard Shortcuts', icon: 'i-lucide-keyboard', shortcut: 'Ctrl+/', onSelect: () => {} },
				{ type: 'separator' },
				{ label: 'About', icon: 'i-lucide-info', onSelect: () => {} },
			],
		},
	]);

	const compactMenus: MenuBarMenu[] = [
		{
			label: 'File',
			items: [
				{ label: 'New', shortcut: 'Ctrl+N', onSelect: () => {} },
				{ label: 'Open', shortcut: 'Ctrl+O', onSelect: () => {} },
				{ label: 'Save', shortcut: 'Ctrl+S', onSelect: () => {} },
			],
		},
		{
			label: 'Edit',
			items: [
				{ label: 'Undo', shortcut: 'Ctrl+Z', onSelect: () => {} },
				{ label: 'Redo', shortcut: 'Ctrl+Y', onSelect: () => {} },
			],
		},
	];
</script>

<section id="menu-menubar" class="section">
	<h2 class="section-title">Menu Bar</h2>
	<p class="section-description">
		Traditional application-style horizontal menu bar. Use when: building a desktop-style application
		with persistent top-level menus (editors, IDEs, admin tools).
	</p>

	<div class="demos">
		<DemoCard
			title="Code Editor Menu Bar"
			description="Domain-specific menu bar with File, Edit, View, Help menus, shortcuts, and checkbox toggle items."
		>
			<div class="menubar-wrapper">
				<MenuBar menus={editorMenus} />

				<div class="menubar-status">
					<span class="status-item">Word Wrap: <strong>{wordWrap ? 'On' : 'Off'}</strong></span>
					<span class="status-item">Minimap: <strong>{minimap ? 'On' : 'Off'}</strong></span>
					<span class="status-item">Line Numbers: <strong>{lineNumbers ? 'On' : 'Off'}</strong></span>
				</div>
			</div>
		</DemoCard>

		<DemoCard
			title="Compact Menu Bar"
			description="Minimal menu bar with fewer items. Use when: space is constrained but top-level menu access is still needed."
		>
			<MenuBar menus={compactMenus} />
		</DemoCard>
	</div>
</section>

<style>
	.section {
		scroll-margin-top: 5rem;
		margin-bottom: var(--spacing-8);
	}

	.section-title {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.section-description {
		margin: 0 0 var(--spacing-7) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.menubar-wrapper {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		width: 100%;
	}

	.menubar-status {
		display: flex;
		gap: var(--spacing-5);
		padding: var(--spacing-3) var(--spacing-4);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.status-item strong {
		color: var(--color-fg);
	}
</style>
