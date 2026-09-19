/**
 * PANEL MENU COMPOSITION — one composed array serves every surface.
 *
 * The desktop kebab (DockLeaf), the mobile commands sheet and the keyboard
 * matcher (DeskShortcuts) all consume the SAME composed array for the same
 * focused panel; a difference between surfaces is a bug, not a responsive
 * adaptation. The one projection rule lives here, not in the hosts: the
 * dock-level View menu is appended only where the host passes one — the
 * mobile sheet passes none because the panels drawer already projects those
 * commands on touch (show-or-open per type, Preferences), and the sheet must
 * never reach the structural toggle/split verbs.
 *
 * The dock-supplied "Panel" floor menu guarantees the array is never empty
 * (median registered payload is one item; Preview registers none), and gives
 * the panel's own commands — switch instance, close, about — one predictable
 * home instead of per-panel reinventions. `About <panel>` rides the floor so
 * Help is never a one-item menu; the host still owns the lazily loaded
 * InfoDialog and only lends `help.open`.
 *
 * Pure — no runes, node-testable.
 */

import type { MenuBarItem, MenuBarMenu } from '$lib/components/composites/menu-bar/types';
import type { PanelDefinition } from '$lib/desk/layout.types';

/** Declared once; the tab context menu prints it beside its own Close row. */
export const CLOSE_PANEL_SHORTCUT = 'Ctrl+W';

export interface PanelInstanceRef {
	id: string;
	label: string;
}

/** The panel's help entry — the host renders the dialog, the floor menu the row. */
export interface PanelHelpRef {
	title: string;
	open: () => void;
}

export interface ComposeMenusInput {
	/** Menus the panel registered (from the panel-menus registry). */
	registered: MenuBarMenu[];
	/** The panel the menu addresses (null → floor menu is empty). */
	panel: PanelDefinition | null;
	/** Open instances of the same panel TYPE, tree order, including `panel`. */
	instances: PanelInstanceRef[];
	/** The View menu for this projection (buildViewMenu output); null on the mobile sheet. */
	viewMenu: MenuBarMenu | null;
	actions: {
		focusPanel: (panelId: string) => void;
		/** Close one panel (hosts route it through the dock's unsaved-close guard). */
		closePanel: (panelId: string) => void;
		/** Close several at once — one guard prompt for the batch, not one per panel. */
		closePanels: (panelIds: string[]) => void;
	};
	/** When present, `About <title>` closes the floor menu. */
	help?: PanelHelpRef | null;
}

/** Compose the full menu array: [...registered, Panel floor, View?] — separators normalised, empty menus dropped. */
export function composePanelMenus(input: ComposeMenusInput): MenuBarMenu[] {
	const { registered, panel, instances, viewMenu, actions, help } = input;

	const floor: MenuBarMenu = { label: 'Panel', items: [] };
	if (panel) {
		const siblings = instances.filter((inst) => inst.id !== panel.id);
		if (siblings.length > 0) {
			for (const sibling of siblings) {
				floor.items.push({
					label: `Switch to ${sibling.label}`,
					icon: panel.icon,
					onSelect: () => actions.focusPanel(sibling.id),
				});
			}
			floor.items.push({ type: 'separator' });
		}
		// Ctrl+W lives here, not on the View menu: one row closes this panel, and
		// a panel that cannot be closed has no row for the chord to reach.
		if (panel.closable !== false) {
			floor.items.push({
				label: 'Close Panel',
				icon: 'i-lucide-x',
				shortcut: CLOSE_PANEL_SHORTCUT,
				onSelect: () => actions.closePanel(panel.id),
			});
		}
		if (siblings.length > 0) {
			floor.items.push({
				label: 'Close Other Instances',
				icon: 'i-lucide-x-circle',
				destructive: true,
				onSelect: () => actions.closePanels(siblings.map((sibling) => sibling.id)),
			});
		}
		if (help) {
			if (floor.items.length > 0) floor.items.push({ type: 'separator' });
			floor.items.push({ label: `About ${help.title}`, icon: 'i-lucide-info', onSelect: help.open });
		}
	}

	return [...registered, floor, ...(viewMenu ? [viewMenu] : [])]
		.map((menu) => ({ ...menu, items: withoutDanglingSeparators(menu.items) }))
		.filter((menu) => menu.items.length > 0);
}

/**
 * Conditional spreads routinely leave a separator first, last or doubled (the
 * editor's File menu on a saved post is `[separator, Export]`). Normalised here,
 * once, so no projection renders a rule the others drop.
 */
function withoutDanglingSeparators(items: MenuBarItem[]): MenuBarItem[] {
	const out: MenuBarItem[] = [];
	for (const item of items) {
		if (item.type === 'separator' && (out.length === 0 || out[out.length - 1].type === 'separator')) continue;
		out.push(item);
	}
	while (out.length > 0 && out[out.length - 1].type === 'separator') out.pop();
	return out;
}

/**
 * The About dialog's shortcut table, derived from the composed array so the
 * dialog can never list a chord the menu no longer shows (or miss one it does).
 * Returns '' when nothing declares a shortcut; otherwise a markdown table the
 * host appends to the panel's prose notes.
 */
export function shortcutTableMarkdown(menus: MenuBarMenu[]): string {
	const rows: string[] = [];
	for (const menu of menus) {
		for (const item of menu.items) {
			if (item.type === 'separator' || !item.shortcut || !item.label) continue;
			rows.push(`| ${item.shortcut} | ${menu.label} › ${item.label} |`);
		}
	}
	if (rows.length === 0) return '';
	return ['| Shortcut | Action |', '|---|---|', ...rows].join('\n');
}

/** Tree-ordered open instances of `panel`'s type — helper for compose callers. */
export function collectTypeInstances(
	openPanelIds: string[],
	panels: Record<string, PanelDefinition>,
	panelType: string | undefined,
): PanelInstanceRef[] {
	if (!panelType) return [];
	return openPanelIds
		.filter((id) => panels[id]?.type === panelType)
		.map((id) => ({ id, label: panels[id]?.label ?? id }));
}
