/**
 * File tree builder — aggregates desk files/folders, blog posts, and assets
 * into a unified tree structure. Used by the AI tool `desk_file_tree` and
 * (eventually) the Explorer panel.
 *
 * No SvelteKit imports — pure domain function.
 */

import { listAssets, listPosts } from '$lib/server/blog/queries';
import { listFiles, listFolders } from '$lib/server/db/desk/queries';

// ── Types ───────────────────────────────────────────────────────────

export interface FileTreeNode {
	name: string;
	kind: 'folder' | 'spreadsheet' | 'markdown' | 'post' | 'image';
	id: string;
	children?: FileTreeNode[];
	meta?: string;
}

// ── Main ────────────────────────────────────────────────────────────

export async function getFileTree(userId: string): Promise<FileTreeNode[]> {
	const [filesResult, foldersResult, postsResult, assetsResult] = await Promise.allSettled([
		listFiles(userId),
		listFolders(userId),
		listPosts({ authorId: userId, pageSize: 200 }),
		listAssets(userId),
	]);

	const files = filesResult.status === 'fulfilled' ? filesResult.value.items : [];
	const folders = foldersResult.status === 'fulfilled' ? foldersResult.value.items : [];
	const posts = postsResult.status === 'fulfilled' ? postsResult.value.items : [];
	const assets = assetsResult.status === 'fulfilled' ? assetsResult.value.items : [];

	if (filesResult.status === 'rejected') console.warn('[file-tree] Failed to fetch desk files:', filesResult.reason);
	if (foldersResult.status === 'rejected')
		console.warn('[file-tree] Failed to fetch desk folders:', foldersResult.reason);
	if (postsResult.status === 'rejected') console.warn('[file-tree] Failed to fetch blog posts:', postsResult.reason);
	if (assetsResult.status === 'rejected') console.warn('[file-tree] Failed to fetch blog assets:', assetsResult.reason);

	const roots: FileTreeNode[] = [];

	// blog/
	if (posts.length > 0) {
		roots.push({
			id: 'virtual:blog',
			name: 'blog',
			kind: 'folder',
			children: posts.map((p) => ({
				id: p.id,
				name: `${p.slug}.md`,
				kind: 'post' as const,
				meta: `[${p.status}]`,
			})),
		});
	}

	// assets/images/
	if (assets.length > 0) {
		roots.push({
			id: 'virtual:assets',
			name: 'assets',
			kind: 'folder',
			children: [
				{
					id: 'virtual:images',
					name: 'images',
					kind: 'folder',
					children: assets.map((a) => ({
						id: a.id,
						name: a.fileName,
						kind: 'image' as const,
						meta: `(${formatBytes(a.fileSize)})`,
					})),
				},
			],
		});
	}

	// data/ (desk folders + files)
	roots.push(buildDataTree(folders, files));

	return roots;
}

// ── Data tree builder ───────────────────────────────────────────────

function buildDataTree(
	folders: { id: string; parentId: string | null; name: string }[],
	files: { id: string; type: string; name: string; folderId: string | null }[],
): FileTreeNode {
	const folderMap = new Map<string, FileTreeNode>();
	for (const f of folders) {
		folderMap.set(f.id, { id: f.id, name: f.name, kind: 'folder', children: [] });
	}

	const dataNode: FileTreeNode = { id: 'virtual:data', name: 'data', kind: 'folder', children: [] };

	for (const f of folders) {
		const node = folderMap.get(f.id);
		if (!node) continue;
		const parent = f.parentId ? folderMap.get(f.parentId) : undefined;
		if (parent) {
			parent.children?.push(node);
		} else {
			dataNode.children?.push(node);
		}
	}

	for (const f of files) {
		const fileNode: FileTreeNode = {
			id: f.id,
			name: f.name,
			kind: f.type as 'spreadsheet' | 'markdown',
		};
		const parent = f.folderId ? folderMap.get(f.folderId) : undefined;
		if (parent) {
			parent.children?.push(fileNode);
		} else {
			dataNode.children?.push(fileNode);
		}
	}

	sortChildren(dataNode);
	return dataNode;
}

function sortChildren(node: FileTreeNode): void {
	if (!node.children) return;
	node.children.sort((a, b) => {
		const aIsFolder = a.children !== undefined ? 0 : 1;
		const bIsFolder = b.children !== undefined ? 0 : 1;
		if (aIsFolder !== bIsFolder) return aIsFolder - bIsFolder;
		return a.name.localeCompare(b.name);
	});
	for (const child of node.children) sortChildren(child);
}

// ── Text rendering ──────────────────────────────────────────────────

export function renderFileTree(roots: FileTreeNode[]): string {
	const lines: string[] = [];
	for (const root of roots) {
		renderNode(root, '', true, lines);
	}
	return lines.join('\n');
}

function renderNode(node: FileTreeNode, prefix: string, isLast: boolean, lines: string[]): void {
	const connector = prefix === '' ? '' : isLast ? '└─ ' : '├─ ';
	const meta = node.meta ? ` ${node.meta}` : '';
	const kindSuffix = node.children !== undefined ? '/' : ` (${node.kind})`;
	lines.push(`${prefix}${connector}${node.name}${kindSuffix}${meta}`);

	if (node.children) {
		const childPrefix = prefix === '' ? '' : prefix + (isLast ? '   ' : '│  ');
		for (let i = 0; i < node.children.length; i++) {
			renderNode(node.children[i], childPrefix, i === node.children.length - 1, lines);
		}
	}
}

/** Render tree + append ID index for cross-referencing with desk_read_file. */
export function renderFileTreeWithIndex(roots: FileTreeNode[]): string {
	const tree = renderFileTree(roots);
	const index: string[] = [];
	collectLeafIds(roots, index);
	if (index.length === 0) return tree;
	return `${tree}\n\n## IDs\n${index.join('\n')}`;
}

function collectLeafIds(nodes: FileTreeNode[], out: string[]): void {
	for (const n of nodes) {
		if (n.children) {
			collectLeafIds(n.children, out);
		} else {
			out.push(`${n.name}=${n.id}`);
		}
	}
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
