import type { ExplorerNode, NodeCapability } from '../node';
import type { AssetListItem } from '../types';

const ASSET_CAPABILITIES: NodeCapability[] = [
	'open',
	'open-new-panel',
	'rename',
	'insert-into-document',
	'copy-url',
	'delete',
];

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
		capabilities: new Set(),
		sortKey: '0_1_assets',
	};
}

export function imagesRootNode(): ExplorerNode {
	return {
		id: 'virtual:images',
		parentId: 'virtual:assets',
		source: 'virtual',
		sourceData: {},
		label: 'images',
		icon: 'i-lucide-image',
		iconColor: 'var(--color-warning, #d4a72c)',
		isFolder: true,
		capabilities: new Set(),
		sortKey: '0_0_images',
	};
}

export function adaptBlogAssets(assets: AssetListItem[]): ExplorerNode[] {
	return assets.map((a) => ({
		id: a.id,
		parentId: 'virtual:images',
		source: 'blog-asset' as const,
		sourceData: a as unknown as Record<string, unknown>,
		label: a.fileName,
		icon: 'i-lucide-image',
		iconColor: 'var(--color-success, #22c55e)',
		isFolder: false,
		capabilities: new Set<NodeCapability>(ASSET_CAPABILITIES),
		sortKey: `1_${a.fileName.toLowerCase()}`,
		subtitle: formatBytes(a.fileSize),
	}));
}
