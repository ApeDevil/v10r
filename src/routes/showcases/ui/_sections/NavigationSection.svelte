<script lang="ts">
	import { DemoCard } from '../_components';
	import { PageHeader, MenuBar, QuickSearch, Button } from '$lib/components';

	let searchOpen = $state(false);
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
		<DemoCard title="Menu Bar" description="Application menu bar with keyboard shortcuts">
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
							{ label: 'Zoom In', shortcut: 'Ctrl++' },
							{ label: 'Zoom Out', shortcut: 'Ctrl+-' },
							{ type: 'separator' },
							{ label: 'Full Screen', shortcut: 'F11' }
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
</style>
