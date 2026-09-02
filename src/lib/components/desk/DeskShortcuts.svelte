<script lang="ts">
import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
import { getDeskSettings } from './desk-settings.state.svelte';
import { getDockContext } from './dock.state.svelte';
import { closeCurrent, splitFocused, togglePanelType } from './panel-actions';
import { getPanelMenus } from './panel-menus.state.svelte';
import { buildViewMenu } from './view-menu';
import { getWorkspaceContext } from './workspace.state.svelte';

const dock = getDockContext();
const deskSettings = getDeskSettings();
const workspace = getWorkspaceContext();

// The same composed menus the kebab renders — shortcut matching and the
// visible menu can no longer drift (one buildViewMenu factory, one registry).
const panelMenus = getPanelMenus();
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
const menus = $derived<MenuBarMenu[]>([...panelMenus.active.menuBar, viewMenu]);

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isEditing(el: Element): boolean {
	return INPUT_TAGS.has(el.tagName) || (el as HTMLElement).isContentEditable;
}

function normalizeShortcut(e: KeyboardEvent): string {
	const parts: string[] = [];
	if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
	if (e.shiftKey) parts.push('Shift');
	parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
	return parts.join('+');
}

function handleKeyDown(e: KeyboardEvent) {
	if (isEditing(e.target as Element)) return;

	const ctrl = e.ctrlKey || e.metaKey;
	if (!ctrl) return;

	// Workspace shortcuts: Ctrl+Alt+1-9
	if (e.altKey && !e.shiftKey) {
		const num = Number.parseInt(e.key, 10);
		if (num >= 1 && num <= 9) {
			const target = workspace.workspaces[num - 1];
			if (target) {
				e.preventDefault();
				workspace.switchTo(target.id);
				return;
			}
		}
	}

	// Menu-declared shortcuts (View menu + panel-registered menus) — the menus
	// array is the single truth, so a shortcut can never point at a command the
	// kebab no longer shows.
	const shortcut = normalizeShortcut(e);
	for (const menu of menus) {
		for (const item of menu.items) {
			if (item.type === 'separator') continue;
			if (item.shortcut && item.shortcut === shortcut && !item.disabled && item.onSelect) {
				e.preventDefault();
				item.onSelect();
				return;
			}
		}
	}
}
</script>

<svelte:window onkeydown={handleKeyDown} />
