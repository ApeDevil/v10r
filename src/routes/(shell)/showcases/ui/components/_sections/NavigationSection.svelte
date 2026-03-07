<script lang="ts">
	import { DemoCard } from '../_components';
	import { PageHeader, MenuBar, QuickSearch, Button } from '$lib/components';
	import { ContextMenu } from '$lib/components/composites/context-menu';

	let searchOpen = $state(false);
	let showLineNumbers = $state(false);
	let wordWrap = $state(true);

	const contextMenuItems = [
		{ label: 'View Details', icon: 'i-lucide-eye', onclick: () => {} },
		{ label: 'Edit', icon: 'i-lucide-pencil', shortcut: 'Ctrl+E', onclick: () => {} },
		{ label: 'Copy', icon: 'i-lucide-copy', shortcut: 'Ctrl+C', onclick: () => {} },
		{ separator: true },
		{ label: 'Archive', icon: 'i-lucide-archive', disabled: true, onclick: () => {} },
		{ label: 'Delete', icon: 'i-lucide-trash-2', shortcut: 'Ctrl+Del', onclick: () => {} }
	];
</script>

<section id="comp-navigation" class="section">
	<h2 class="section-title">Navigation</h2>
	<p class="section-description">Components for navigating between pages and sections.</p>

	<div class="demos">
		<!-- PageHeader -->
		<DemoCard title="Page Header" description="Page title and breadcrumbs">
			<div class="page-header-demo">
				<PageHeader
					title="Page Title"
					description="This is a page description that explains what this page is about."
					breadcrumbs={[
						{ label: 'Home', href: '/' },
						{ label: 'Showcases', href: '/showcases' },
						{ label: 'UI' }
					]}
				/>
			</div>
		</DemoCard>

		<!-- MenuBar -->
		<DemoCard title="Menu Bar" description="Application menu bar with checkboxes, icons, shortcuts">
			<MenuBar
				menus={[
					{
						label: 'File',
						items: [
							{ label: 'New', shortcut: 'Ctrl+N', icon: 'i-lucide-file-plus' },
							{ label: 'Open', shortcut: 'Ctrl+O', icon: 'i-lucide-folder-open' },
							{ type: 'separator' },
							{ label: 'Save', shortcut: 'Ctrl+S', icon: 'i-lucide-save' },
							{ label: 'Save As...', shortcut: 'Ctrl+⇧+S' }
						]
					},
					{
						label: 'Edit',
						items: [
							{ label: 'Undo', shortcut: 'Ctrl+Z', icon: 'i-lucide-undo' },
							{ label: 'Redo', shortcut: 'Ctrl+⇧+Z', icon: 'i-lucide-redo' },
							{ type: 'separator' },
							{ label: 'Cut', shortcut: 'Ctrl+X' },
							{ label: 'Copy', shortcut: 'Ctrl+C' },
							{ label: 'Paste', shortcut: 'Ctrl+V' }
						]
					},
					{
						label: 'View',
						items: [
							{ type: 'checkbox', label: 'Line Numbers', checked: showLineNumbers, onSelect: () => { showLineNumbers = !showLineNumbers; } },
							{ type: 'checkbox', label: 'Word Wrap', checked: wordWrap, onSelect: () => { wordWrap = !wordWrap; } },
							{ type: 'separator' },
							{ label: 'Zoom In', shortcut: 'Ctrl++', icon: 'i-lucide-zoom-in' },
							{ label: 'Zoom Out', shortcut: 'Ctrl+-', icon: 'i-lucide-zoom-out' },
							{ type: 'separator' },
							{ label: 'Full Screen', shortcut: 'F11' }
						]
					},
					{
						label: 'Help',
						items: [
							{ label: 'Documentation', icon: 'i-lucide-book-open' },
							{ label: 'Keyboard Shortcuts', icon: 'i-lucide-keyboard', shortcut: 'Ctrl+/' },
							{ type: 'separator' },
							{ label: 'About', icon: 'i-lucide-info' }
						]
					}
				]}
			/>
		</DemoCard>

		<!-- Quick Search -->
		<DemoCard title="Quick Search" description="Command palette with Ctrl+K shortcut">
			<Button variant="outline" onclick={() => (searchOpen = true)}>
				<span class="i-lucide-search h-4 w-4 mr-2" aria-hidden="true" />
				Open Quick Search
			</Button>

			<QuickSearch
				bind:open={searchOpen}
				items={[
					{ id: '1', type: 'recent', label: 'UI Showcase', icon: 'i-lucide-palette', href: '/showcases/ui' },
					{ id: '2', type: 'page', label: 'Home', icon: 'i-lucide-home', href: '/' },
					{ id: '3', type: 'page', label: 'Showcases', icon: 'i-lucide-layout', href: '/showcases' },
					{ id: '4', type: 'action', label: 'Toggle Theme', icon: 'i-lucide-sun' }
				]}
			/>
		</DemoCard>

		<!-- Context Menu -->
		<DemoCard title="Context Menu" description="Right-click menu with icons, shortcuts, disabled items">
			<ContextMenu items={contextMenuItems}>
				{#snippet trigger({ props })}
					<div class="context-trigger" {...props}>
						<p class="context-text">Right-click this area</p>
						<p class="context-hint">Opens a context menu with actions</p>
					</div>
				{/snippet}
			</ContextMenu>
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

	.page-header-demo {
		width: 100%;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.context-trigger {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 10rem;
		width: 100%;
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
		cursor: context-menu;
	}

	.context-text {
		margin: 0;
		font-size: var(--text-fluid-base);
		font-weight: 600;
		color: var(--color-fg);
	}

	.context-hint {
		margin: var(--spacing-1) 0 0 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}
</style>
