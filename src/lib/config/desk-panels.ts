import type { ActivityBarItem, PanelDefinition } from '$lib/components/composites/dock';

export const DESK_PANEL_TYPES = [
	'explorer',
	'editor',
	'preview',
	'chat',
	'spreadsheet',
] as const;

export type DeskPanelType = (typeof DESK_PANEL_TYPES)[number];

export const DESK_PANELS: Record<string, PanelDefinition> = {
	explorer: { id: 'explorer', type: 'explorer', label: 'Explorer', icon: 'i-lucide-folder-tree', closable: true },
	editor: { id: 'editor', type: 'editor', label: 'Editor', icon: 'i-lucide-pen-line', closable: true },
	preview: { id: 'preview', type: 'preview', label: 'Preview', icon: 'i-lucide-eye', closable: true },
	chat: { id: 'chat', type: 'chat', label: 'Chat', icon: 'i-lucide-message-circle', closable: true },
	spreadsheet: { id: 'spreadsheet', type: 'spreadsheet', label: 'Spreadsheet', icon: 'i-lucide-sheet', closable: true },
};

export const DESK_ACTIVITY_BAR_ITEMS: ActivityBarItem[] = [
	{ panelType: 'explorer', icon: 'i-lucide-folder-tree', label: 'Explorer' },
	{ panelType: 'editor', icon: 'i-lucide-pen-line', label: 'Editor' },
	{ panelType: 'preview', icon: 'i-lucide-eye', label: 'Preview' },
	{ panelType: 'chat', icon: 'i-lucide-message-circle', label: 'Chat' },
	{ panelType: 'spreadsheet', icon: 'i-lucide-sheet', label: 'Spreadsheet' },
];
