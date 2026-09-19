<script lang="ts">
import type { Snippet } from 'svelte';
import { InfoDialog } from '$lib/components/composites/info-dialog';
import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
import { DESK_PANEL_HELP } from '$lib/desk/help';
import type { LeafNode } from '$lib/desk/layout.types';
import type { DeskPanelType } from '$lib/desk/panels';
import { collectTypeInstances, composePanelMenus, shortcutTableMarkdown } from './compose-menus';
import DockDropOverlay from './DockDropOverlay.svelte';
import DockTabBar from './DockTabBar.svelte';
import { getDeskSettings } from './desk-settings.state.svelte';
import { collectPanelIds } from './dock.operations';
import { getDockContext } from './dock.state.svelte';
import { focusPanel, splitFocused, togglePanelType } from './panel-actions';
import { getPanelMenus } from './panel-menus.state.svelte';
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

// The leaf owns the (lazily loaded) About dialog; the floor menu only gets the row.
let helpOpen = $state(false);
const panelHelp = $derived(focusedPanelType ? (DESK_PANEL_HELP[focusedPanelType as DeskPanelType] ?? null) : null);

const viewMenu = $derived<MenuBarMenu>(
	buildViewMenu({
		items: dock.activityBarItems,
		togglePanelType: (panelType) => togglePanelType(dock, panelType),
		splitFocused: (zone) => splitFocused(dock, zone),
		openPreferences: () => deskSettings.openDialog(),
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
			closePanel: (panelId) => dock.requestClose(panelId),
			closePanels: (panelIds) =>
				dock.requestClosePanels(panelIds, () => {
					for (const id of panelIds) dock.closePanel(id);
				}),
		},
		help: panelHelp
			? {
					title: panelHelp.title,
					open: () => {
						helpOpen = true;
					},
				}
			: null,
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
		<DockTabBar {leaf} menus={leafMenus} />
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

{#if panelHelp}
	<InfoDialog
		bind:open={helpOpen}
		noTrigger
		title={panelHelp.title}
		description={panelHelp.description}
		icon={panelHelp.icon}
		ariaLabel="About {panelHelp.title}"
		doc={{ name: panelHelp.title, notes: `${panelHelp.notes}\n\n${shortcutTableMarkdown(leafMenus)}` }}
	/>
{/if}

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
