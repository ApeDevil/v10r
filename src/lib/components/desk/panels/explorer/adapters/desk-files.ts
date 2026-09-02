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

const FOLDER_CAPABILITIES: NodeCapability[] = ['rename', 'move', 'delete', 'new-folder', 'new-spreadsheet'];

export function dataRootNode(): ExplorerNode {
	return {
		id: 'virtual:data',
		parentId: null,
		source: 'virtual',
		sourceData: {},
		label: 'data',
		icon: 'i-lucide-database',
		iconColor: 'var(--color-warning, #d4a72c)',
		isFolder: true,
		capabilities: new Set<NodeCapability>(['new-folder', 'new-spreadsheet']),
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
		iconColor: 'var(--color-warning, #d4a72c)',
		isFolder: true,
		capabilities: new Set<NodeCapability>(FOLDER_CAPABILITIES),
		sortKey: `0_${f.name.toLowerCase()}`,
	}));
}

export function adaptDeskFiles(files: FileListItem[]): ExplorerNode[] {
	return files.map((f) => {
		const isMarkdown = f.type === 'markdown';
		return {
			id: f.id,
			parentId: f.folderId ?? 'virtual:data',
			source: 'desk-file' as const,
			sourceData: f as unknown as Record<string, unknown>,
			label: f.name,
			icon: isMarkdown ? 'i-lucide-file-text' : 'i-lucide-sheet',
			iconColor: isMarkdown ? 'var(--color-primary, #6366f1)' : 'var(--color-success, #22c55e)',
			isFolder: false,
			capabilities: new Set<NodeCapability>(isMarkdown ? MARKDOWN_CAPABILITIES : SPREADSHEET_CAPABILITIES),
			aiContext: f.aiContext,
			sortKey: `1_${f.name.toLowerCase()}`,
		};
	});
}
