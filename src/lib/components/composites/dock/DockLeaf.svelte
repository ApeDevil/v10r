<script lang="ts">
import type { Snippet } from 'svelte';
import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
import { collectTypeInstances, composePanelMenus } from './compose-menus';
import DockDropOverlay from './DockDropOverlay.svelte';
import DockTabBar from './DockTabBar.svelte';
import { getDeskSettings } from './desk-settings.svelte';
import { collectPanelIds } from './dock.operations';
import { getDockContext } from './dock.state.svelte';
import type { LeafNode } from './dock.types';
import { closeCurrent, focusPanel, splitFocused, togglePanelType } from './panel-actions';
import { getPanelMenus } from './panel-menus.svelte';
import { buildViewMenu } from './view-menu';

interface Props {
	leaf: LeafNode;
	panelContent: Snippet<[string]>;
}

let { leaf, panelContent }: Props = $props();

const dock = getDockContext();
const deskSettings = getDeskSettings();
const panelMenus = getPanelMenus();

const focusedPanelType = $derived(dock.panels[leaf.activeTab]?.type ?? null);

const viewMenu = $derived<MenuBarMenu>(
	buildViewMenu({
		structural: true,
		actions: {
			togglePanelType: (panelType) => togglePanelType(dock, panelType),
			splitFocused: (zone) => splitFocused(dock, zone),
			closeFocusedPanel: () => closeCurrent(dock),
			openPreferences: () => deskSettings.openDialog(),
		},
	}),
);

// Composed for THIS leaf's active tab (instance-correct — a background leaf's
// kebab must not show the focused panel's menus), same composition contract as
// the mobile commands sheet.
const leafMenus = $derived<MenuBarMenu[]>(
	composePanelMenus({
		registered: panelMenus.getMenus(leaf.activeTab).menuBar,
		panel: dock.panels[leaf.activeTab] ?? null,
		instances: collectTypeInstances(collectPanelIds(dock.root), dock.panels, focusedPanelType ?? undefined),
		viewMenu,
		actions: {
			focusPanel: (panelId) => focusPanel(dock, panelId),
			closePanel: (panelId) => dock.closePanel(panelId),
		},
	}),
);

// Per-panel-type color override (inline CSS vars on the leaf element)
const leafStyle = $derived.by(() => {
	const panelType = dock.panels[leaf.activeTab]?.type ?? '';
	const resolved = deskSettings.resolvePanel(panelType);
	const parts: string[] = [];
	if (resolved.bg) parts.push(`--desk-panel-bg: ${resolved.bg}`);
	return parts.join('; ') || undefined;
});
</script>

<!-- Focus is the dock's single truth: menus and AI context follow it via
	DockLayout's focus-follower effect, so this handler only moves the leaf. -->
<div class="dock-leaf" style={leafStyle} onfocusin={() => dock.setFocusedLeaf(leaf.id)} onpointerdown={() => dock.setFocusedLeaf(leaf.id)}>
	{#if leaf.tabs.length > 0}
		<DockTabBar {leaf} menus={leafMenus} panelType={focusedPanelType} />
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
		background: var(--desk-panel-bg, var(--surface-1));
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
