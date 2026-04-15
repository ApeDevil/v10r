import type { ExplorerNode, NodeCapability } from '../node';
import type { AssetListItem, FolderListItem } from '../types';

const ASSET_CAPABILITIES: NodeCapability[] = [
	'open',
	'open-new-panel',
	'rename',
	'move',
	'insert-into-document',
	'copy-url',
	'delete',
];

const ASSET_FOLDER_CAPABILITIES: NodeCapability[] = ['rename', 'move', 'new-folder', 'delete'];

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const value = bytes / 1024 ** i;
	return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function assetsRootNode(): ExplorerNode {
	return {
		id: 'virtual:assets',
		parentId: null,
		source: 'virtual',
		sourceData: {},
		label: 'assets',
		icon: 'i-lucide-layers',
		iconColor: 'var(--color-muted)',
		isFolder: true,
		capabilities: new Set<NodeCapability>(['new-folder']),
		sortKey: '0_1_assets',
	};
}

export function adaptAssetFolders(folders: FolderListItem[]): ExplorerNode[] {
	return folders.map((f) => ({
		id: f.id,
		parentId: f.parentId ?? 'virtual:assets',
		source: 'asset-folder' as const,
		sourceData: f as unknown as Record<string, unknown>,
		label: f.name,
		icon: 'i-lucide-folder',
		iconColor: 'var(--color-muted)',
		isFolder: true,
		capabilities: new Set<NodeCapability>(ASSET_FOLDER_CAPABILITIES),
		sortKey: `0_${f.name.toLowerCase()}`,
	}));
}

export function adaptBlogAssets(assets: AssetListItem[]): ExplorerNode[] {
	return assets.map((a) => ({
		id: a.id,
		parentId: a.folderId ?? 'virtual:assets',
		source: 'blog-asset' as const,
		sourceData: a as unknown as Record<string, unknown>,
		label: a.fileName,
		icon: a.mimeType.startsWith('image/') ? 'i-lucide-image' : 'i-lucide-file',
		iconColor: 'var(--color-success, #22c55e)',
		isFolder: false,
		capabilities: new Set<NodeCapability>(ASSET_CAPABILITIES),
		sortKey: `1_${a.fileName.toLowerCase()}`,
		subtitle: formatBytes(a.fileSize),
	}));
}
