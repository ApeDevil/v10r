import type { ExplorerNode, NodeCapability } from '../node';
import type { PostListItem } from '../types';

const POST_CAPABILITIES: NodeCapability[] = ['open', 'open-new-panel', 'rename', 'ai-context', 'export-markdown', 'delete'];

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
		capabilities: new Set(),
		sortKey: '0_0_blog',
	};
}

export function adaptBlogPosts(posts: PostListItem[]): ExplorerNode[] {
	return posts.map((p) => ({
		id: p.id,
		parentId: 'virtual:blog',
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
