import type { ExplorerNode, NodeCapability } from '../node';
import type { FileListItem, FolderListItem } from '../types';

const SPREADSHEET_CAPABILITIES: NodeCapability[] = [
	'open',
	'open-new-panel',
	'rename',
	'duplicate',
	'move',
	'ai-context',
	'delete',
];

const MARKDOWN_CAPABILITIES: NodeCapability[] = ['open', 'open-new-panel', 'rename', 'move', 'ai-context', 'delete'];

/** A record file: no duplicate yet (a copy would need fresh attribute ids to stay distinct records). */
const RECORD_CAPABILITIES: NodeCapability[] = ['open', 'open-new-panel', 'rename', 'move', 'ai-context', 'delete'];

const FOLDER_CAPABILITIES: NodeCapability[] = [
	'rename',
	'move',
	'delete',
	'new-folder',
	'new-spreadsheet',
	'new-record',
];

/** How each desk file type looks in the tree and what its context menu offers. */
const FILE_PRESENTATION: Record<
	FileListItem['type'],
	{ icon: string; iconColor: string; capabilities: NodeCapability[] }
> = {
	spreadsheet: { icon: 'i-lucide-sheet', iconColor: 'var(--color-success)', capabilities: SPREADSHEET_CAPABILITIES },
	markdown: { icon: 'i-lucide-file-text', iconColor: 'var(--color-primary)', capabilities: MARKDOWN_CAPABILITIES },
	record: { icon: 'i-lucide-list-tree', iconColor: 'var(--color-secondary)', capabilities: RECORD_CAPABILITIES },
};

export function dataRootNode(): ExplorerNode {
	return {
		id: 'virtual:data',
		parentId: null,
		source: 'virtual',
		sourceData: {},
		label: 'data',
		icon: 'i-lucide-database',
		iconColor: 'var(--color-warning)',
		isFolder: true,
		capabilities: new Set<NodeCapability>(['new-folder', 'new-spreadsheet', 'new-record']),
		sortKey: '0_2_data',
	};
}

export function adaptDeskFolders(folders: FolderListItem[]): ExplorerNode[] {
	return folders.map((f) => ({
		id: f.id,
		parentId: f.parentId ?? 'virtual:data',
		source: 'desk-folder' as const,
		sourceData: f as unknown as Record<string, unknown>,
		label: f.name,
		icon: 'i-lucide-folder',
		iconColor: 'var(--color-warning)',
		isFolder: true,
		capabilities: new Set<NodeCapability>(FOLDER_CAPABILITIES),
		sortKey: `0_${f.name.toLowerCase()}`,
	}));
}

export function adaptDeskFiles(files: FileListItem[]): ExplorerNode[] {
	return files.map((f) => {
		const look = FILE_PRESENTATION[f.type];
		return {
			id: f.id,
			parentId: f.folderId ?? 'virtual:data',
			source: 'desk-file' as const,
			sourceData: f as unknown as Record<string, unknown>,
			label: f.name,
			icon: look.icon,
			iconColor: look.iconColor,
			isFolder: false,
			capabilities: new Set<NodeCapability>(look.capabilities),
			aiContext: f.aiContext,
			sortKey: `1_${f.name.toLowerCase()}`,
		};
	});
}
