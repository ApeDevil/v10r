/**
 * CONTEXT MENU ITEMS — Capability-driven menu builder for Explorer tree nodes.
 *
 * Groups: Open → AI Context → Edit → Type-specific → Create → Destructive.
 * Items only appear if the node's capabilities include the matching action.
 * Empty groups are omitted.
 */
import type { ExplorerNode, NodeCapability } from './node';

export interface MenuItemDef {
	type: 'item';
	label: string;
	icon: string;
	action: string;
	destructive?: boolean;
}

export interface MenuSeparatorDef {
	type: 'separator';
}

export type MenuEntry = MenuItemDef | MenuSeparatorDef;

export interface ContextMenuCallbacks {
	onOpen?: (node: ExplorerNode) => void;
	onOpenNewPanel?: (node: ExplorerNode) => void;
	onRename?: (node: ExplorerNode) => void;
	onDuplicate?: (node: ExplorerNode) => void;
	onDelete?: (node: ExplorerNode) => void;
	onToggleAiContext?: (node: ExplorerNode) => void;
	onExportMarkdown?: (node: ExplorerNode) => void;
	onInsertIntoDocument?: (node: ExplorerNode) => void;
	onCopyUrl?: (node: ExplorerNode) => void;
	onNewFolder?: (node: ExplorerNode) => void;
	onNewSpreadsheet?: (node: ExplorerNode) => void;
}

type CapabilityItemDef = {
	capability: string;
	label: string | ((node: ExplorerNode) => string);
	icon: string | ((node: ExplorerNode) => string);
	action: string;
	destructive?: boolean;
};

const GROUPS: CapabilityItemDef[][] = [
	// Group 1: Open actions
	[
		{ capability: 'open', label: 'Open', icon: 'i-lucide-square-arrow-out-up-right', action: 'open' },
		{
			capability: 'open-new-panel',
			label: 'Open in New Panel',
			icon: 'i-lucide-panels-top-left',
			action: 'openNewPanel',
		},
	],
	// Group 2: AI Context
	[
		{
			capability: 'ai-context',
			label: (node) => (node.aiContext ? 'Unpin from AI Context' : 'Pin to AI Context'),
			icon: (node) => (node.aiContext ? 'i-lucide-pin-off' : 'i-lucide-pin'),
			action: 'toggleAiContext',
		},
	],
	// Group 3: Edit
	[
		{ capability: 'rename', label: 'Rename', icon: 'i-lucide-pencil', action: 'rename' },
		{ capability: 'duplicate', label: 'Duplicate', icon: 'i-lucide-copy', action: 'duplicate' },
	],
	// Group 4: Type-specific
	[
		{ capability: 'export-markdown', label: 'Export as Markdown', icon: 'i-lucide-download', action: 'exportMarkdown' },
		{
			capability: 'insert-into-document',
			label: 'Insert into Document',
			icon: 'i-lucide-image-plus',
			action: 'insertIntoDocument',
		},
		{ capability: 'copy-url', label: 'Copy URL', icon: 'i-lucide-link', action: 'copyUrl' },
	],
	// Group 5: Create (folder nodes only)
	[
		{ capability: 'new-folder', label: 'New Folder', icon: 'i-lucide-folder-plus', action: 'newFolder' },
		{ capability: 'new-spreadsheet', label: 'New Spreadsheet', icon: 'i-lucide-sheet', action: 'newSpreadsheet' },
	],
	// Group 6: Destructive
	[{ capability: 'delete', label: 'Delete', icon: 'i-lucide-trash-2', action: 'delete', destructive: true }],
];

export function buildContextMenuItems(node: ExplorerNode): MenuEntry[] {
	const items: MenuEntry[] = [];
	let lastGroupHadItems = false;

	for (const group of GROUPS) {
		const groupItems: MenuItemDef[] = [];
		for (const def of group) {
			if (!node.capabilities.has(def.capability as NodeCapability)) continue;
			groupItems.push({
				type: 'item',
				label: typeof def.label === 'function' ? def.label(node) : def.label,
				icon: typeof def.icon === 'function' ? def.icon(node) : def.icon,
				action: def.action,
				destructive: def.destructive,
			});
		}
		if (groupItems.length > 0) {
			if (lastGroupHadItems) items.push({ type: 'separator' });
			items.push(...groupItems);
			lastGroupHadItems = true;
		}
	}

	return items;
}

/** Dispatch a menu action to the appropriate callback. */
export function dispatchMenuAction(action: string, node: ExplorerNode, callbacks: ContextMenuCallbacks): void {
	const map: Record<string, keyof ContextMenuCallbacks> = {
		open: 'onOpen',
		openNewPanel: 'onOpenNewPanel',
		rename: 'onRename',
		duplicate: 'onDuplicate',
		delete: 'onDelete',
		toggleAiContext: 'onToggleAiContext',
		exportMarkdown: 'onExportMarkdown',
		insertIntoDocument: 'onInsertIntoDocument',
		copyUrl: 'onCopyUrl',
		newFolder: 'onNewFolder',
		newSpreadsheet: 'onNewSpreadsheet',
	};
	const key = map[action];
	if (key) (callbacks[key] as (n: ExplorerNode) => void)?.(node);
}
