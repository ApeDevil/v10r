/**
 * The canonical View menu — ONE factory for every surface that renders or
 * matches it (desktop kebab via DockLeaf, keyboard matching via DeskShortcuts,
 * the mobile commands sheet). Before this factory the menu existed as three
 * drifting copies.
 *
 * `structural: false` strips the split commands — mobile performs only
 * non-structural dock operations, so the persisted desktop tree shape is
 * untouched (see DockMobileView's contract comment).
 */

import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';

export interface ViewMenuActions {
	togglePanelType: (panelType: string) => void;
	splitFocused: (zone: 'right' | 'bottom') => void;
	closeFocusedPanel: () => void;
	openPreferences: () => void;
}

export function buildViewMenu(opts: { structural: boolean; actions: ViewMenuActions }): MenuBarMenu {
	const { structural, actions } = opts;
	return {
		label: 'View',
		items: [
			{
				label: 'Toggle Explorer',
				icon: 'i-lucide-folder-tree',
				shortcut: 'Ctrl+Shift+E',
				onSelect: () => actions.togglePanelType('explorer'),
			},
			{
				label: 'Toggle Preview',
				icon: 'i-lucide-eye',
				shortcut: 'Ctrl+Shift+P',
				onSelect: () => actions.togglePanelType('preview'),
			},
			...(structural
				? ([
						{ type: 'separator' },
						{ label: 'Split Right', icon: 'i-lucide-columns-2', onSelect: () => actions.splitFocused('right') },
						{ label: 'Split Down', icon: 'i-lucide-rows-2', onSelect: () => actions.splitFocused('bottom') },
					] satisfies MenuBarMenu['items'])
				: []),
			{ type: 'separator' },
			{
				label: 'Close Active Panel',
				icon: 'i-lucide-x',
				shortcut: 'Ctrl+W',
				onSelect: actions.closeFocusedPanel,
			},
			{ type: 'separator' },
			{
				label: 'Desk Preferences…',
				icon: 'i-lucide-settings',
				shortcut: 'Ctrl+Shift+,',
				onSelect: actions.openPreferences,
			},
		],
	};
}
