import type { ExplorerNode, NodeCapability } from '../node';
import type { FolderListItem, PostListItem } from '../types';

const POST_CAPABILITIES: NodeCapability[] = [
	'open',
	'open-new-panel',
	'rename',
	'move',
	'ai-context',
	'export-markdown',
	'delete',
];

const POST_FOLDER_CAPABILITIES: NodeCapability[] = ['rename', 'move', 'new-folder', 'new-post', 'delete'];

function statusVariant(status: string): 'success' | 'secondary' | 'warning' {
	if (status === 'published') return 'success';
	if (status === 'archived') return 'warning';
	return 'secondary';
}

export function blogRootNode(): ExplorerNode {
	return {
		id: 'virtual:blog',
		parentId: null,
		source: 'virtual',
		sourceData: {},
		label: 'blog',
		icon: 'i-lucide-book-open',
		iconColor: 'var(--color-primary)',
		isFolder: true,
		capabilities: new Set<NodeCapability>(['new-folder', 'new-post']),
		sortKey: '0_0_blog',
	};
}

export function adaptBlogFolders(folders: FolderListItem[]): ExplorerNode[] {
	return folders.map((f) => ({
		id: f.id,
		parentId: f.parentId ?? 'virtual:blog',
		source: 'blog-folder' as const,
		sourceData: f as unknown as Record<string, unknown>,
		label: f.name,
		icon: 'i-lucide-folder',
		iconColor: 'var(--color-primary)',
		isFolder: true,
		capabilities: new Set<NodeCapability>(POST_FOLDER_CAPABILITIES),
		sortKey: `0_${f.name.toLowerCase()}`,
	}));
}

export function adaptBlogPosts(posts: PostListItem[]): ExplorerNode[] {
	return posts.map((p) => ({
		id: p.id,
		parentId: p.folderId ?? 'virtual:blog',
		source: 'blog-post' as const,
		sourceData: p as unknown as Record<string, unknown>,
		label: `${p.slug}.md`,
		icon: 'i-lucide-file-text',
		iconColor: 'var(--color-primary)',
		isFolder: false,
		capabilities: new Set<NodeCapability>(POST_CAPABILITIES),
		aiContext: false,
		sortKey: `1_${p.slug}`,
		badge: { text: p.status, variant: statusVariant(p.status) },
		subtitle: p.title || '(untitled)',
	}));
}
