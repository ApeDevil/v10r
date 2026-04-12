import type { ActivityBarItem, PanelDefinition } from '$lib/components/composites/dock';

export const DESK_PANEL_TYPES = ['explorer', 'editor', 'preview', 'bot', 'spreadsheet', 'io-log'] as const;

export type DeskPanelType = (typeof DESK_PANEL_TYPES)[number];

export const DESK_PANELS: Record<string, PanelDefinition> = {
	explorer: { id: 'explorer', type: 'explorer', label: 'Explorer', icon: 'i-lucide-folder-tree', closable: true },
	editor: { id: 'editor', type: 'editor', label: 'Editor', icon: 'i-lucide-pen-line', closable: true },
	preview: { id: 'preview', type: 'preview', label: 'Preview', icon: 'i-lucide-eye', closable: true },
	bot: { id: 'bot', type: 'bot', label: 'Bot', icon: 'i-lucide-bot', closable: true },
	spreadsheet: { id: 'spreadsheet', type: 'spreadsheet', label: 'Spreadsheet', icon: 'i-lucide-sheet', closable: true },
	'io-log': { id: 'io-log', type: 'io-log', label: 'I/O Log', icon: 'i-lucide-activity', closable: true },
};

export const DESK_ACTIVITY_BAR_ITEMS: ActivityBarItem[] = Object.values(DESK_PANELS).map((p) => ({
	panelType: p.type,
	icon: p.icon,
	label: p.label,
}));
