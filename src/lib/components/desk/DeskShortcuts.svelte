<script lang="ts">
import { trackCommand } from '$lib/analytics/telemetry';
import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
import { registerShortcut } from '$lib/shortcuts';
import { collectTypeInstances, composePanelMenus } from './compose-menus';
import { getDeskSettings } from './desk-settings.state.svelte';
import { collectPanelIds } from './dock.operations';
import { getDockContext } from './dock.state.svelte';
import { focusPanel, splitFocused, togglePanelType } from './panel-actions';
import { getPanelMenus } from './panel-menus.state.svelte';
import { buildViewMenu } from './view-menu';
import { getWorkspaceContext } from './workspace.state.svelte';

interface Props {
	/**
	 * Which projection is mounted. The mobile projection has no View menu (the
	 * panels drawer is its View), so its chords must not exist either — a
	 * hardware keyboard on a phone would otherwise reach `togglePanelType`, the
	 * structural close-all-of-type verb touch never gets.
	 */
	desktop: boolean;
}

let { desktop }: Props = $props();

const dock = getDockContext();
const deskSettings = getDeskSettings();
const workspace = getWorkspaceContext();

// The same composed array the focused panel's kebab (or the mobile sheet)
// renders — registered menus, the Panel floor (Ctrl+W lives there) and, on
// desktop, the View menu — so shortcut matching and the visible menu cannot drift.
const panelMenus = getPanelMenus();
const viewMenu = $derived<MenuBarMenu | null>(
	desktop
		? buildViewMenu({
				items: dock.activityBarItems,
				togglePanelType: (panelType) => togglePanelType(dock, panelType),
				splitFocused: (zone) => splitFocused(dock, zone),
				openPreferences: () => deskSettings.openDialog(),
			})
		: null,
);
const focusedPanel = $derived(dock.focusedPanelId ? (dock.panels[dock.focusedPanelId] ?? null) : null);
const menus = $derived<MenuBarMenu[]>(
	composePanelMenus({
		registered: panelMenus.active.menuBar,
		panel: focusedPanel,
		instances: collectTypeInstances(collectPanelIds(dock.root), dock.panels, focusedPanel?.type),
		viewMenu,
		actions: {
			focusPanel: (panelId) => focusPanel(dock, panelId),
			closePanel: (panelId) => dock.requestClose(panelId),
			closePanels: (panelIds) =>
				dock.requestClosePanels(panelIds, () => {
					for (const id of panelIds) dock.closePanel(id);
				}),
		},
	}),
);

/** `Ctrl+Shift+E` (menu talk) → `mod+shift+e` (registry talk). */
function toRegistryKeys(shortcut: string): string {
	return shortcut.toLowerCase().replace(/^ctrl\+/, 'mod+');
}

// Discovery for the expert path: list the desk's chords in the shell's shortcuts
// dialog (shift+/) while the desk is mounted. Display-only — this component is
// the dispatcher, so the shell handler must never fire them a second time.
$effect(() => {
	const unregister = [
		registerShortcut({
			id: 'desk:workspace-switch',
			keys: 'mod+alt+1–9',
			description: 'Switch to workspace 1–9',
			category: 'desk',
			dispatch: false,
		}),
	];
	for (const menu of menus) {
		for (const item of menu.items) {
			if (item.type === 'separator' || !item.shortcut || !item.label) continue;
			unregister.push(
				registerShortcut({
					id: `desk:${menu.label}:${item.label}`,
					keys: toRegistryKeys(item.shortcut),
					description: `${menu.label} › ${item.label}`,
					category: 'desk',
					dispatch: false,
				}),
			);
		}
	}
	return () => {
		for (const off of unregister) off();
	};
});

function normalizeShortcut(e: KeyboardEvent): string {
	const parts: string[] = [];
	if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
	if (e.shiftKey) parts.push('Shift');
	parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
	return parts.join('+');
}

// No "not while editing" guard on purpose: the editor's text is a textarea and
// that is where the writer is when Ctrl+S, Ctrl+, or Ctrl+Shift+X matter. Every
// desk chord is a modifier chord and the array is composed for the focused panel
// only, so nothing here can steal a plain key from a field. The constraint this
// leaves: never declare a chord the browser owns inside a text field
// (Ctrl+A/Z/Y/C/V/X) — the matcher would take it from the textarea.
function handleKeyDown(e: KeyboardEvent) {
	const ctrl = e.ctrlKey || e.metaKey;
	if (!ctrl) return;

	// Workspace shortcuts: Ctrl+Alt+1-9
	if (e.altKey && !e.shiftKey) {
		const num = Number.parseInt(e.key, 10);
		if (num >= 1 && num <= 9) {
			const target = workspace.workspaces[num - 1];
			if (target) {
				e.preventDefault();
				trackCommand('shortcut', `Workspace › Switch to ${num}`);
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
				trackCommand('shortcut', `${menu.label} › ${item.label}`);
				item.onSelect();
				return;
			}
		}
	}
}
</script>

<svelte:window onkeydown={handleKeyDown} />
