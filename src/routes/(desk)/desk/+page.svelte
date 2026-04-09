<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { ChatPanel } from '$lib/components/chat';
import type { LayoutNode } from '$lib/components/composites/dock';
import { DockLayout } from '$lib/components/composites/dock';
import { EditorPanel } from '$lib/components/editor';
import { ExplorerPanel } from '$lib/components/explorer';
import IOLogPanel from '$lib/components/io-log/IOLogPanel.svelte';
import { PreviewPanel } from '$lib/components/preview';
import { SpreadsheetPanel } from '$lib/components/spreadsheet';
import { DESK_ACTIVITY_BAR_ITEMS, DESK_PANEL_TYPES, DESK_PANELS } from '$lib/config/desk-panels';

// Server data from (desk)/+layout.server.ts
const authenticated = $derived(!!page.data.session?.user?.id);
const serverTheme = $derived(page.data.deskTheme ?? null);
const serverPresets = $derived(page.data.deskPresets ?? []);
const serverWorkspaces = $derived(page.data.deskWorkspaces ?? []);
const serverActiveWorkspaceId = $derived(page.data.deskActiveWorkspaceId ?? null);

let openPanel = $derived(page.url.searchParams.get('open'));

// Clean URL param after it's consumed
$effect(() => {
	if (openPanel && page.url.searchParams.has('open')) {
		goto(page.url.pathname, { replaceState: true });
	}
});

const initialRoot: LayoutNode = {
	type: 'split',
	id: 'desk-root',
	direction: 'horizontal',
	sizes: [25, 75],
	children: [
		{
			type: 'split',
			id: 'desk-left',
			direction: 'vertical',
			sizes: [55, 45],
			children: [
				{
					type: 'leaf',
					id: 'desk-left-top',
					tabs: ['explorer'],
					activeTab: 'explorer',
				},
				{
					type: 'leaf',
					id: 'desk-left-bottom',
					tabs: ['bot'],
					activeTab: 'bot',
				},
			],
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
					tabs: ['editor', 'preview'],
					activeTab: 'editor',
				},
				{
					type: 'leaf',
					id: 'desk-right-bottom',
					tabs: ['spreadsheet'],
					activeTab: 'spreadsheet',
				},
			],
		},
	],
};

/** Resolve panel type — handles dynamic IDs from activity bar (e.g. "editor-1709312345") */
function getPanelType(panelId: string): string | undefined {
	return DESK_PANEL_TYPES.find((t) => panelId === t || panelId.startsWith(`${t}-`));
}
</script>

<svelte:head>
	<title>Desk - Velociraptor</title>
</svelte:head>

<div class="desk-page">
	<DockLayout
		{initialRoot}
		initialPanels={DESK_PANELS}
		activityBarItems={DESK_ACTIVITY_BAR_ITEMS}
		persist="desk-layout"
		{openPanel}
		{authenticated}
		{serverTheme}
		{serverPresets}
		{serverWorkspaces}
		{serverActiveWorkspaceId}
		class="desk-dock"
	>
		{#snippet panelContent(panelId)}
			{@const type = getPanelType(panelId)}
			<div class="desk-panel">
				{#if type === 'explorer'}
					<ExplorerPanel />
				{:else if type === 'editor'}
					<EditorPanel {panelId} />
				{:else if type === 'preview'}
					<PreviewPanel />
				{:else if type === 'bot'}
					<ChatPanel {panelId} />
				{:else if type === 'spreadsheet'}
					<SpreadsheetPanel {panelId} />
				{:else if type === 'io-log'}
					<IOLogPanel {panelId} />
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
