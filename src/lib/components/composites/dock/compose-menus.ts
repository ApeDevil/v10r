/**
 * PANEL MENU COMPOSITION — one composed array serves every surface.
 *
 * The desktop kebab (DockLeaf) and the mobile commands sheet render the SAME
 * composed array for the same focused panel; a difference between surfaces is
 * a bug, not a responsive adaptation. Help is appended by the host that owns
 * the (lazily loaded) InfoDialog, not here.
 *
 * The dock-supplied "Panel" floor menu guarantees the array is never empty
 * (median registered payload is one item; Preview registers none), and gives
 * close/switch-instance commands one predictable home instead of per-panel
 * reinventions.
 *
 * Pure — no runes, node-testable.
 */

import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
import type { PanelDefinition } from './dock.types';

export interface PanelInstanceRef {
	id: string;
	label: string;
}

export interface ComposeMenusInput {
	/** Menus the panel registered (from the panel-menus registry). */
	registered: MenuBarMenu[];
	/** The panel the menu addresses (null → floor menu is empty). */
	panel: PanelDefinition | null;
	/** Open instances of the same panel TYPE, tree order, including `panel`. */
	instances: PanelInstanceRef[];
	/** The View menu for this surface (buildViewMenu output). */
	viewMenu: MenuBarMenu;
	actions: {
		focusPanel: (panelId: string) => void;
		closePanel: (panelId: string) => void;
	};
}

/** Compose the full menu array: [...registered, Panel floor, View]. */
export function composePanelMenus(input: ComposeMenusInput): MenuBarMenu[] {
	const { registered, panel, instances, viewMenu, actions } = input;

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
		if (panel.closable !== false) {
			floor.items.push({
				label: 'Close Panel',
				icon: 'i-lucide-x',
				onSelect: () => actions.closePanel(panel.id),
			});
		}
		if (siblings.length > 0) {
			floor.items.push({
				label: 'Close Other Instances',
				icon: 'i-lucide-x-circle',
				destructive: true,
				onSelect: () => {
					for (const sibling of siblings) actions.closePanel(sibling.id);
				},
			});
		}
	}

	const menus = registered.filter((menu) => menu.items.some((item) => item.type !== 'separator'));
	if (floor.items.length > 0) menus.push(floor);
	menus.push(viewMenu);
	return menus;
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
