import type { PanelDefinition, ActivityBarItem } from '$lib/components/composites/dock';

export const DESK_PANEL_TYPES = [
	'notes',
	'canvas',
	'terminal',
	'gallery',
	'inbox',
	'dashboard',
	'chat',
	'spreadsheet',
	'files'
] as const;

export type DeskPanelType = (typeof DESK_PANEL_TYPES)[number];

export const DESK_PANELS: Record<string, PanelDefinition> = {
	notes: { id: 'notes', type: 'notes', label: 'Notes', icon: 'i-lucide-notebook-pen', closable: true },
	canvas: { id: 'canvas', type: 'canvas', label: 'Canvas', icon: 'i-lucide-pen-tool', closable: true },
	terminal: { id: 'terminal', type: 'terminal', label: 'Terminal', icon: 'i-lucide-terminal', closable: true },
	gallery: { id: 'gallery', type: 'gallery', label: 'Gallery', icon: 'i-lucide-image', closable: true },
	inbox: { id: 'inbox', type: 'inbox', label: 'Inbox', icon: 'i-lucide-inbox', closable: true },
	dashboard: { id: 'dashboard', type: 'dashboard', label: 'Dashboard', icon: 'i-lucide-bar-chart-3', closable: true },
	chat: { id: 'chat', type: 'chat', label: 'Chat', icon: 'i-lucide-message-circle', closable: true },
	spreadsheet: { id: 'spreadsheet', type: 'spreadsheet', label: 'Spreadsheet', icon: 'i-lucide-sheet', closable: true },
	files: { id: 'files', type: 'files', label: 'Files', icon: 'i-lucide-folder-tree', closable: true },
};

export const DESK_ACTIVITY_BAR_ITEMS: ActivityBarItem[] = [
	{ panelType: 'notes', icon: 'i-lucide-notebook-pen', label: 'Notes' },
	{ panelType: 'canvas', icon: 'i-lucide-pen-tool', label: 'Canvas' },
	{ panelType: 'terminal', icon: 'i-lucide-terminal', label: 'Terminal' },
	{ panelType: 'gallery', icon: 'i-lucide-image', label: 'Gallery' },
	{ panelType: 'inbox', icon: 'i-lucide-inbox', label: 'Inbox' },
	{ panelType: 'dashboard', icon: 'i-lucide-bar-chart-3', label: 'Dashboard' },
	{ panelType: 'chat', icon: 'i-lucide-message-circle', label: 'Chat' },
	{ panelType: 'spreadsheet', icon: 'i-lucide-sheet', label: 'Spreadsheet' },
	{ panelType: 'files', icon: 'i-lucide-folder-tree', label: 'Files' },
];
