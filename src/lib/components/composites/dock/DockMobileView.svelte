<script lang="ts">
/**
 * Mobile (<768px) desk mode: ONE panel visible full-height + a bottom
 * switcher bar, replacing the resizable multi-pane tree.
 *
 * Contract: the dock state stays the single source of truth — panels read
 * `dock.root` and call `dock.addPanel` (explorer file-opens, AI panel-opens),
 * so mobile performs only the NON-STRUCTURAL operations the desktop activity
 * bar already performs (activateTab / ensurePanelType / closePanel /
 * setFocusedLeaf). It never renders or triggers splits, drags, or resizes, so
 * the persisted desktop tree SHAPE is untouched. Only the visible-panel
 * pointer below is mobile-local and unpersisted.
 */
import type { Snippet } from 'svelte';
import * as m from '$lib/paraglide/messages';
import { getModals } from '$lib/state/modals.svelte';
import DockMobileBar from './DockMobileBar.svelte';
import { getDeskSettings } from './desk-settings.svelte';
import { collectPanelIds, findLeafWithPanel, nextPanelOfType } from './dock.operations';
import { getDockContext } from './dock.state.svelte';
import type { ActivityBarItem } from './dock.types';

interface Props {
	items: ActivityBarItem[];
	openPanel?: string | null;
	panelContent: Snippet<[string]>;
}

let { items, openPanel, panelContent }: Props = $props();

const dock = getDockContext();
const deskSettings = getDeskSettings();
const modals = getModals();

const openPanelIds = $derived(collectPanelIds(dock.root));

// Mobile-local visible-panel pointer. Initialized once: ?open= type match →
// focused panel → first open panel. (DockLayout's own openPanel effect adds
// the panel if its type isn't open yet; the auto-surface effect then shows it.)
// svelte-ignore state_referenced_locally
let mobileActiveId = $state<string | null>(
	(openPanel ? collectPanelIds(dock.root).find((id) => dock.panels[id]?.type === openPanel) : null) ??
		dock.focusedPanelId ??
		collectPanelIds(dock.root)[0] ??
		null,
);

// Self-heals when the visible panel is closed (falls back to the first).
const visibleId = $derived(
	mobileActiveId && openPanelIds.includes(mobileActiveId) ? mobileActiveId : (openPanelIds[0] ?? null),
);

/** Show a panel AND activate it on its real leaf — panels derive their own
 * active state (preview-follow, menus) from the tree, not from this view. */
function show(panelId: string) {
	mobileActiveId = panelId;
	const leafNode = findLeafWithPanel(dock.root, panelId);
	if (leafNode) {
		dock.activateTab(leafNode.id, panelId);
		dock.setFocusedLeaf(leafNode.id);
	}
}

/** Bar tap: cycle instances of the type; open one if none exists. */
function selectType(panelType: string) {
	const next = nextPanelOfType(dock.root, dock.panels, panelType, visibleId);
	if (next) {
		show(next);
		return;
	}
	const item = items.find((entry) => entry.panelType === panelType);
	// Adds to the tree — the auto-surface effect below brings it into view.
	dock.ensurePanelType(panelType, item?.label, item?.icon);
}

// Auto-surface: any panel that APPEARS in the tree (explorer opening a file,
// the AI `ai:open_panel` desk effect, ensurePanelType above) becomes visible —
// with zero changes inside panel code. First run only records the baseline.
let previousIds: Set<string> | null = null;
$effect(() => {
	const ids = openPanelIds;
	if (previousIds === null) {
		previousIds = new Set(ids);
		return;
	}
	const fresh = ids.filter((id) => !previousIds?.has(id));
	previousIds = new Set(ids);
	if (fresh.length > 0) show(fresh[fresh.length - 1]);
});
</script>

<div class="dock-mobile-content">
	{#if openPanelIds.length === 0}
		<div class="dock-mobile-empty">
			<span class="i-lucide-layout-grid empty-icon" aria-hidden="true"></span>
			<p>{m.composites_dock_mobile_empty()}</p>
		</div>
	{:else}
		<!-- Keep-alive: every open panel stays mounted (mirrors DockLeaf's stacked
			tab panels) — switching must not destroy editor buffers or chat state. -->
		{#each openPanelIds as id (id)}
			<div class="dock-mobile-panel" class:active={id === visibleId}>
				{@render panelContent(id)}
			</div>
		{/each}
	{/if}
</div>

<DockMobileBar
	{items}
	panels={dock.panels}
	{openPanelIds}
	{visibleId}
	onSelect={selectType}
	onShowPanel={show}
	onCloseCurrent={() => {
		if (visibleId) dock.closePanel(visibleId);
	}}
	onOpenPreferences={() => deskSettings.openDialog()}
	onOpenSearch={() => modals.open('quickSearch')}
/>

<style>
	.dock-mobile-content {
		grid-area: content;
		position: relative;
		min-height: 0;
		overflow: hidden;
	}

	.dock-mobile-panel {
		position: absolute;
		inset: 0;
		display: none;
		overflow: auto;
	}

	.dock-mobile-panel.active {
		display: block;
	}

	.dock-mobile-empty {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-3);
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		text-align: center;
		padding: var(--spacing-6);
	}

	.dock-mobile-empty .empty-icon {
		width: 32px;
		height: 32px;
		opacity: 0.6;
	}
</style>
