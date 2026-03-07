<script lang="ts">
	import { Card } from '$lib/components';
	import { DockLayout } from '$lib/components/composites/dock';
	import type { LayoutNode, PanelDefinition, ActivityBarItem } from '$lib/components/composites/dock';

	// --- Panel definitions ---
	const panels: Record<string, PanelDefinition> = {
		explorer: {
			id: 'explorer',
			type: 'explorer',
			label: 'Explorer',
			icon: 'i-lucide-folder-tree',
			closable: true
		},
		editor: {
			id: 'editor',
			type: 'editor',
			label: 'Editor',
			icon: 'i-lucide-file-code',
			closable: true
		},
		terminal: {
			id: 'terminal',
			type: 'terminal',
			label: 'Terminal',
			icon: 'i-lucide-terminal',
			closable: true
		},
		output: {
			id: 'output',
			type: 'output',
			label: 'Output',
			icon: 'i-lucide-scroll-text',
			closable: true
		},
		search: {
			id: 'search',
			type: 'search',
			label: 'Search',
			icon: 'i-lucide-search',
			closable: true
		},
		preview: {
			id: 'preview',
			type: 'preview',
			label: 'Preview',
			icon: 'i-lucide-eye',
			closable: true
		}
	};

	// --- Layout tree ---
	// Explorer (left) | Editor + Preview (right-top) | Terminal + Output (right-bottom)
	const initialRoot: LayoutNode = {
		type: 'split',
		id: 'root-split',
		direction: 'horizontal',
		sizes: [25, 75],
		children: [
			{
				type: 'leaf',
				id: 'leaf-sidebar',
				tabs: ['explorer', 'search'],
				activeTab: 'explorer'
			},
			{
				type: 'split',
				id: 'split-main',
				direction: 'vertical',
				sizes: [65, 35],
				children: [
					{
						type: 'leaf',
						id: 'leaf-editor',
						tabs: ['editor', 'preview'],
						activeTab: 'editor'
					},
					{
						type: 'leaf',
						id: 'leaf-bottom',
						tabs: ['terminal', 'output'],
						activeTab: 'terminal'
					}
				]
			}
		]
	};

	// --- Activity bar items ---
	const activityBarItems: ActivityBarItem[] = [
		{ panelType: 'explorer', icon: 'i-lucide-folder-tree', label: 'Explorer' },
		{ panelType: 'search', icon: 'i-lucide-search', label: 'Search' },
		{ panelType: 'terminal', icon: 'i-lucide-terminal', label: 'Terminal' },
		{ panelType: 'output', icon: 'i-lucide-scroll-text', label: 'Output' },
		{ panelType: 'preview', icon: 'i-lucide-eye', label: 'Preview' }
	];
</script>

<svelte:head>
	<title>Dock Panels - UI Showcase - Velociraptor</title>
</svelte:head>

<main class="content">
	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Interactive Dock</h2>
		<p class="text-fluid-base text-muted mb-fluid-4">
			Drag tabs between panels to rearrange. Drop on edges to split, center to add as tab. Close tabs with the X button. Use the activity bar to toggle panel visibility.
		</p>

		<Card>
			<div class="dock-container">
				<DockLayout
					{initialRoot}
					initialPanels={panels}
					{activityBarItems}
					persist={true}
					class="dock-demo"
				>
					{#snippet panelContent(panelId)}
						{@const panel = panels[panelId]}
						{#if panel}
							<div class="panel-content">
								<div class="panel-header">
									{#if panel.icon}
										<span class={panel.icon} style="font-size: 24px;"></span>
									{/if}
									<h3>{panel.label}</h3>
								</div>
								<p class="text-fluid-sm text-muted">
									{#if panel.type === 'explorer'}
										File tree navigation. Drag this tab to another panel to move it.
									{:else if panel.type === 'editor'}
										Code editing area. Multiple editor tabs can be stacked.
									{:else if panel.type === 'terminal'}
										Integrated terminal. Create multiple instances via the activity bar.
									{:else if panel.type === 'output'}
										Build output and logs. Typically docked at the bottom.
									{:else if panel.type === 'search'}
										Project-wide search. Usually paired with the explorer.
									{:else if panel.type === 'preview'}
										Live preview of the current document or page.
									{/if}
								</p>
							</div>
						{:else}
							<div class="panel-content panel-unknown">
								<p class="text-fluid-sm text-muted">Panel: {panelId}</p>
							</div>
						{/if}
					{/snippet}
				</DockLayout>
			</div>
		</Card>
	</section>

	<section>
		<h2 class="text-fluid-2xl font-bold mb-fluid-3">Features</h2>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-fluid-4">
			<Card>
				<h3 class="text-fluid-lg font-semibold mb-2">Drag & Drop</h3>
				<ul class="list-disc list-inside text-fluid-sm text-muted space-y-1">
					<li>Drag tabs between panels</li>
					<li>Drop on edges to create splits</li>
					<li>Drop on center to add as tab</li>
					<li>Reorder tabs within a panel</li>
				</ul>
			</Card>

			<Card>
				<h3 class="text-fluid-lg font-semibold mb-2">Layout Control</h3>
				<ul class="list-disc list-inside text-fluid-sm text-muted space-y-1">
					<li>Activity bar toggles panel visibility</li>
					<li>Close tabs to collapse empty splits</li>
					<li>Resize splits via pane handles</li>
					<li>Binary tree: max 4 nesting levels</li>
				</ul>
			</Card>

			<Card>
				<h3 class="text-fluid-lg font-semibold mb-2">Keyboard</h3>
				<ul class="list-disc list-inside text-fluid-sm text-muted space-y-1">
					<li>Tab to navigate between elements</li>
					<li>Arrow keys to reorder tabs</li>
					<li>Enter/Space to activate tab</li>
					<li>Escape to cancel drag</li>
				</ul>
			</Card>

			<Card>
				<h3 class="text-fluid-lg font-semibold mb-2">Architecture</h3>
				<ul class="list-disc list-inside text-fluid-sm text-muted space-y-1">
					<li>Binary split tree (SplitNode | LeafNode)</li>
					<li>PaneForge at each split level</li>
					<li>Recursive rendering with svelte:self</li>
					<li>Context-based state management</li>
				</ul>
			</Card>
		</div>
	</section>
</main>

<style>
	.content {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-fluid-6);
	}

	.dock-container {
		height: 500px;
		border-radius: var(--radius-lg);
		overflow: hidden;
		border: 1px solid var(--color-border);
	}

	:global(.dock-demo) {
		height: 100%;
	}

	.panel-content {
		padding: var(--spacing-4);
		height: 100%;
	}

	.panel-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
		color: var(--color-fg);
	}

	.panel-header h3 {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
	}

	.panel-unknown {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	@media (max-width: 640px) {
		.dock-container {
			height: 400px;
		}
	}
</style>
