import type { ActivityBarItem, PanelDefinition } from './layout.types';

export const DESK_PANEL_TYPES = ['explorer', 'editor', 'preview', 'bot', 'spreadsheet', 'markdown', 'io-log'] as const;

export type DeskPanelType = (typeof DESK_PANEL_TYPES)[number];

export const DESK_PANELS: Record<string, PanelDefinition> = {
	explorer: { id: 'explorer', type: 'explorer', label: 'Explorer', icon: 'i-lucide-folder-tree', closable: true },
	editor: { id: 'editor', type: 'editor', label: 'Editor', icon: 'i-lucide-pen-line', closable: true },
	preview: { id: 'preview', type: 'preview', label: 'Preview', icon: 'i-lucide-eye', closable: true },
	bot: { id: 'bot', type: 'bot', label: 'Bot', icon: 'i-lucide-bot', closable: true },
	spreadsheet: { id: 'spreadsheet', type: 'spreadsheet', label: 'Spreadsheet', icon: 'i-lucide-sheet', closable: true },
	markdown: { id: 'markdown', type: 'markdown', label: 'Document', icon: 'i-lucide-file-text', closable: true },
	'io-log': { id: 'io-log', type: 'io-log', label: 'I/O Log', icon: 'i-lucide-activity', closable: true },
};

/**
 * The two panels a writer opens and closes around the editor get a chord; the
 * rest are opened from a file or once per session (review #13). One
 * declaration — the bar tooltip, the View menu, the keyboard matcher, the About
 * table and the shift+/ dialog all read it from the item.
 */
const PANEL_TOGGLE_SHORTCUTS: Partial<Record<DeskPanelType, string>> = {
	explorer: 'Ctrl+Shift+E',
	preview: 'Ctrl+Shift+P',
};

export const DESK_ACTIVITY_BAR_ITEMS: ActivityBarItem[] = Object.values(DESK_PANELS).map((p) => ({
	panelType: p.type,
	icon: p.icon ?? '',
	label: p.label,
	shortcut: PANEL_TOGGLE_SHORTCUTS[p.type as DeskPanelType],
}));
