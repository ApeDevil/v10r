<script lang="ts">
	import { DockLayout } from '$lib/components/composites/dock';
	import type { LayoutNode, PanelDefinition, ActivityBarItem } from '$lib/components/composites/dock';
	import {
		DotPattern,
		GridPattern,
		RetroGrid,
		GradientBlob,
		NoiseTexture,
		RadialGlow
	} from '$lib/components/primitives/decorative/background';

	const panelTypes = ['notes', 'canvas', 'terminal', 'gallery', 'inbox', 'dashboard'] as const;

	const panels: Record<string, PanelDefinition> = {
		notes: { id: 'notes', type: 'notes', label: 'Notes', icon: 'i-lucide-notebook-pen', closable: true },
		canvas: { id: 'canvas', type: 'canvas', label: 'Canvas', icon: 'i-lucide-pen-tool', closable: true },
		terminal: { id: 'terminal', type: 'terminal', label: 'Terminal', icon: 'i-lucide-terminal', closable: true },
		gallery: { id: 'gallery', type: 'gallery', label: 'Gallery', icon: 'i-lucide-image', closable: true },
		inbox: { id: 'inbox', type: 'inbox', label: 'Inbox', icon: 'i-lucide-inbox', closable: true },
		dashboard: { id: 'dashboard', type: 'dashboard', label: 'Dashboard', icon: 'i-lucide-bar-chart-3', closable: true },
	};

	const initialRoot: LayoutNode = {
		type: 'split',
		id: 'desk-root',
		direction: 'horizontal',
		sizes: [30, 70],
		children: [
			{
				type: 'leaf',
				id: 'desk-left',
				tabs: ['notes', 'inbox'],
				activeTab: 'notes'
			},
			{
				type: 'split',
				id: 'desk-right',
				direction: 'vertical',
				sizes: [60, 40],
				children: [
					{
						type: 'leaf',
						id: 'desk-right-top',
						tabs: ['canvas', 'dashboard'],
						activeTab: 'canvas'
					},
					{
						type: 'leaf',
						id: 'desk-right-bottom',
						tabs: ['terminal', 'gallery'],
						activeTab: 'terminal'
					}
				]
			}
		]
	};

	const activityBarItems: ActivityBarItem[] = [
		{ panelType: 'notes', icon: 'i-lucide-notebook-pen', label: 'Notes' },
		{ panelType: 'canvas', icon: 'i-lucide-pen-tool', label: 'Canvas' },
		{ panelType: 'terminal', icon: 'i-lucide-terminal', label: 'Terminal' },
		{ panelType: 'gallery', icon: 'i-lucide-image', label: 'Gallery' },
		{ panelType: 'inbox', icon: 'i-lucide-inbox', label: 'Inbox' },
		{ panelType: 'dashboard', icon: 'i-lucide-bar-chart-3', label: 'Dashboard' },
	];

	/** Resolve panel type — handles dynamic IDs from activity bar (e.g. "notes-1709312345") */
	function getPanelType(panelId: string): string | undefined {
		return panelTypes.find(t => panelId === t || panelId.startsWith(`${t}-`));
	}
</script>

<svelte:head>
	<title>Desk - Velociraptor</title>
</svelte:head>

<div class="desk-page">
	<DockLayout
		{initialRoot}
		initialPanels={panels}
		{activityBarItems}
		persist="desk-layout"
		class="desk-dock"
	>
		{#snippet panelContent(panelId)}
			{@const type = getPanelType(panelId)}
			<div class="desk-panel">
				{#if type === 'notes'}
					<DotPattern opacity={0.08} class="absolute inset-0" />
					<div class="desk-chip"><span class="i-lucide-notebook-pen"></span> Notes</div>
				{:else if type === 'canvas'}
					<GridPattern opacity={0.06} class="absolute inset-0" />
					<div class="desk-chip"><span class="i-lucide-pen-tool"></span> Canvas</div>
				{:else if type === 'terminal'}
					<RetroGrid opacity={0.10} class="absolute inset-0" />
					<div class="desk-chip"><span class="i-lucide-terminal"></span> Terminal</div>
				{:else if type === 'gallery'}
					<GradientBlob opacity={0.08} class="absolute inset-0" />
					<div class="desk-chip"><span class="i-lucide-image"></span> Gallery</div>
				{:else if type === 'inbox'}
					<NoiseTexture opacity={0.06} class="absolute inset-0" />
					<div class="desk-chip"><span class="i-lucide-inbox"></span> Inbox</div>
				{:else if type === 'dashboard'}
					<RadialGlow opacity={0.10} class="absolute inset-0" />
					<div class="desk-chip"><span class="i-lucide-bar-chart-3"></span> Dashboard</div>
				{:else}
					<div class="desk-chip"><span class="i-lucide-layout-grid"></span> {panelId}</div>
				{/if}
			</div>
		{/snippet}
	</DockLayout>
</div>

<style>
	.desk-page {
		flex: 1;
		min-height: 0;
	}

	:global(.desk-dock) {
		flex: 1;
		min-height: 0;
	}

	.desk-panel {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.desk-chip {
		position: absolute;
		top: 8px;
		left: 8px;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		font-size: 12px;
		font-weight: 500;
		color: var(--color-muted);
		background: color-mix(in srgb, var(--surface-1) 60%, transparent);
		backdrop-filter: blur(4px);
		border-radius: var(--radius-md);
		pointer-events: none;
		z-index: 1;
	}

	.desk-chip span {
		font-size: 14px;
	}
</style>
