import type { ActivityBarItem, PanelDefinition } from '$lib/components/composites/dock';

export const DESK_PANEL_TYPES = [
	'documents',
	'editor',
	'preview',
	'notes',
	'canvas',
	'terminal',
	'gallery',
	'inbox',
	'dashboard',
	'chat',
	'spreadsheet',
	'files',
] as const;

export type DeskPanelType = (typeof DESK_PANEL_TYPES)[number];

export const DESK_PANELS: Record<string, PanelDefinition> = {
	documents: { id: 'documents', type: 'documents', label: 'Documents', icon: 'i-lucide-file-text', closable: true },
	editor: { id: 'editor', type: 'editor', label: 'Editor', icon: 'i-lucide-pen-line', closable: true },
	preview: { id: 'preview', type: 'preview', label: 'Preview', icon: 'i-lucide-eye', closable: true },
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
	{ panelType: 'documents', icon: 'i-lucide-file-text', label: 'Documents' },
	{ panelType: 'editor', icon: 'i-lucide-pen-line', label: 'Editor' },
	{ panelType: 'preview', icon: 'i-lucide-eye', label: 'Preview' },
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
