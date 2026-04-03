<script lang="ts">
import type { Snippet } from 'svelte';
import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
import DockDropOverlay from './DockDropOverlay.svelte';
import DockTabBar from './DockTabBar.svelte';
import { getDockContext } from './dock.state.svelte';
import { setContextFocus } from './desk-context.svelte';
import { getActiveMenus, setFocusedPanel } from './panel-menus.svelte';
import { hasPanelType, collectLeaves } from './dock.operations';
import type { LeafNode } from './dock.types';

interface Props {
	leaf: LeafNode;
	panelContent: Snippet<[string]>;
}

let { leaf, panelContent }: Props = $props();

const dock = getDockContext();

const isFocused = $derived(dock.focusedLeafId === leaf.id);
const focusedPanelType = $derived(dock.panels[leaf.activeTab]?.type ?? null);

// View menu — same items as the old DeskMenuBar
function togglePanelType(panelType: string) {
	if (hasPanelType(dock.root, panelType, dock.panels)) {
		const leaves = collectLeaves(dock.root);
		for (const l of leaves) {
			for (const tabId of l.tabs) {
				if (dock.panels[tabId]?.type === panelType) {
					dock.closePanel(tabId);
				}
			}
		}
	} else {
		dock.addPanel({
			id: `${panelType}-${Date.now()}`,
			type: panelType,
			label: panelType.charAt(0).toUpperCase() + panelType.slice(1),
			icon: panelType === 'explorer' ? 'i-lucide-folder-tree' : 'i-lucide-eye',
			closable: true,
		});
	}
}

function splitFocused(zone: 'right' | 'bottom') {
	const panelId = dock.focusedPanelId;
	if (!panelId) return;
	const panel = dock.panels[panelId];
	if (!panel) return;
	dock.addPanel(
		{ id: `${panel.type}-${Date.now()}`, type: panel.type, label: panel.label, icon: panel.icon, closable: true },
		{ leafId: dock.focusedLeafId!, zone },
	);
}

function closeFocusedPanel() {
	const panelId = dock.focusedPanelId;
	if (panelId) dock.closePanel(panelId);
}

const viewMenu = $derived<MenuBarMenu>({
	label: 'View',
	items: [
		{ label: 'Toggle Explorer', icon: 'i-lucide-folder-tree', shortcut: 'Ctrl+Shift+E', onSelect: () => togglePanelType('explorer') },
		{ label: 'Toggle Preview', icon: 'i-lucide-eye', shortcut: 'Ctrl+Shift+P', onSelect: () => togglePanelType('preview') },
		{ type: 'separator' },
		{ label: 'Split Right', icon: 'i-lucide-columns-2', onSelect: () => splitFocused('right') },
		{ label: 'Split Down', icon: 'i-lucide-rows-2', onSelect: () => splitFocused('bottom') },
		{ type: 'separator' },
		{ label: 'Close Active Panel', icon: 'i-lucide-x', shortcut: 'Ctrl+W', onSelect: closeFocusedPanel },
	],
});

const leafMenus = $derived<MenuBarMenu[]>([
	...getActiveMenus().menuBar,
	viewMenu,
]);
</script>

<div class="dock-leaf" onfocusin={() => { dock.setFocusedLeaf(leaf.id); setFocusedPanel(leaf.activeTab); setContextFocus(leaf.activeTab); }} onpointerdown={() => { dock.setFocusedLeaf(leaf.id); setFocusedPanel(leaf.activeTab); setContextFocus(leaf.activeTab); }}>
	{#if leaf.tabs.length > 0}
		<DockTabBar {leaf} {isFocused} menus={leafMenus} panelType={focusedPanelType} />
		<div class="dock-leaf-content">
			{#each leaf.tabs as tabId (tabId)}
				<div class="dock-tab-panel" class:active={leaf.activeTab === tabId}>
					{@render panelContent(tabId)}
				</div>
			{/each}
			<DockDropOverlay leafId={leaf.id} />
		</div>
	{:else}
		<div class="dock-leaf-empty">
			<p>No panels open</p>
			<DockDropOverlay leafId={leaf.id} />
		</div>
	{/if}
</div>

<style>
	.dock-leaf {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		min-width: 0;
		min-height: 0;
		background: var(--surface-1);
	}

	.dock-leaf-content {
		flex: 1;
		overflow: hidden;
		position: relative;
		min-width: 0;
		min-height: 0;
	}

	.dock-tab-panel {
		position: absolute;
		inset: 0;
		overflow: auto;
		display: none;
	}

	.dock-tab-panel.active {
		display: flex;
		flex-direction: column;
	}

	.dock-leaf-empty {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		color: var(--color-muted);
		font-size: 0.875rem;
	}
</style>
