/**
 * The canonical View menu — ONE factory for every projection that renders or
 * matches it: the desktop kebab (DockLeaf) and the keyboard matcher
 * (DeskShortcuts). One factory, so the two cannot drift. Its toggle rows are
 * derived from the activity-bar items that declare a chord (`$lib/desk/panels`),
 * so the bar's tooltip and the menu's row are one declaration.
 *
 * The mobile commands sheet has no View section: every View command is a
 * dock-level one, and on mobile the panels drawer already projects them (a
 * row per panel type that shows-or-opens, a Preferences row). Mobile performs
 * only non-structural dock operations, so `togglePanelType` (close all of a
 * type) and the splits must never reach a touch surface — see
 * DockMobileView's contract comment and panel-actions.ts.
 *
 * Closing the panel is NOT a View command: the Panel floor menu owns
 * `Close Panel` (Ctrl+W), so one decision has one row (compose-menus.ts).
 */

import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
import type { ActivityBarItem } from '$lib/desk/layout.types';

/** Declared once; the tab context menu prints it beside its own Preferences row. */
export const PREFERENCES_SHORTCUT = 'Ctrl+Shift+,';

export interface ViewMenuInput {
	/**
	 * The host's activity-bar items. Every item that declares a chord becomes a
	 * `Toggle <label>` row — the bar decides which types are promoted to View by
	 * giving them a chord, so the tooltip and the menu can never disagree.
	 */
	items: ActivityBarItem[];
	togglePanelType: (panelType: string) => void;
	splitFocused: (zone: 'right' | 'bottom') => void;
	openPreferences: () => void;
}

export function buildViewMenu(input: ViewMenuInput): MenuBarMenu {
	const toggles = input.items.filter((item) => item.shortcut);
	return {
		label: 'View',
		items: [
			...toggles.map((item) => ({
				label: `Toggle ${item.label}`,
				icon: item.icon,
				shortcut: item.shortcut,
				onSelect: () => input.togglePanelType(item.panelType),
			})),
			{ type: 'separator' as const },
			{ label: 'Split Right', icon: 'i-lucide-columns-2', onSelect: () => input.splitFocused('right') },
			{ label: 'Split Down', icon: 'i-lucide-rows-2', onSelect: () => input.splitFocused('bottom') },
			{ type: 'separator' as const },
			{
				label: 'Desk Preferences…',
				icon: 'i-lucide-settings',
				shortcut: PREFERENCES_SHORTCUT,
				onSelect: input.openPreferences,
			},
		],
	};
}
