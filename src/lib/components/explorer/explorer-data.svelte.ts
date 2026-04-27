/**
 * EXPLORER DATA — fan-in load of all six explorer surfaces.
 *
 * Owns `loading` and `error` reactive state plus the `fetchAll` orchestration
 * (blog posts/folders, assets/folders, desk files/folders → unified
 * `ExplorerNode` array). Pulled out of `ExplorerPanel.svelte` so the panel
 * shell stays small and `fetchAll` is independently callable from the dock
 * `ai:refresh_explorer` bus event without re-mounting the component.
 */
import { apiFetch } from '$lib/api';
import {
	adaptAssetFolders,
	adaptBlogAssets,
	adaptBlogFolders,
	adaptBlogPosts,
	adaptDeskFiles,
	adaptDeskFolders,
	assetsRootNode,
	blogRootNode,
	dataRootNode,
} from './adapters';
import type { ExplorerState } from './explorer-state.svelte';
import type { ExplorerNode } from './node';
import type { PostListItem } from './types';

export class ExplorerData {
	loading = $state<boolean>(true);
	error = $state<string>('');

	setError(msg: string): void {
		this.error = msg;
	}

	clearError(): void {
		this.error = '';
	}

	async fetchAll(state: ExplorerState): Promise<void> {
		this.loading = true;
		this.error = '';
		try {
			const [postsRes, postFoldersRes, assetsRes, assetFoldersRes, filesRes, foldersRes] = await Promise.all([
				apiFetch('/api/blog/posts'),
				apiFetch('/api/blog/post-folders'),
				apiFetch('/api/blog/assets'),
				apiFetch('/api/blog/asset-folders'),
				apiFetch('/api/desk/files'),
				apiFetch('/api/desk/folders'),
			]);

			const nodes: ExplorerNode[] = [
				// Virtual roots — `virtual:images` is gone; an "Images only" filter chip
				// on the assets root replaces the separate tree.
				blogRootNode(),
				assetsRootNode(),
				dataRootNode(),
			];

			if (postsRes.ok) {
				const { data } = await postsRes.json();
				const posts: PostListItem[] = (data.items ?? []).map(
					(p: {
						id: string;
						slug: string;
						status: PostListItem['status'];
						title?: string;
						folderId: string | null;
						updatedAt: string;
					}) => ({
						id: p.id,
						slug: p.slug,
						status: p.status,
						title: p.title ?? '(untitled)',
						folderId: p.folderId ?? null,
						updatedAt: p.updatedAt,
					}),
				);
				nodes.push(...adaptBlogPosts(posts));
			}

			if (postFoldersRes.ok) {
				const { data } = await postFoldersRes.json();
				nodes.push(...adaptBlogFolders(data.folders ?? []));
			}

			if (assetsRes.ok) {
				const { data } = await assetsRes.json();
				nodes.push(...adaptBlogAssets(data.items ?? []));
			}

			if (assetFoldersRes.ok) {
				const { data } = await assetFoldersRes.json();
				nodes.push(...adaptAssetFolders(data.folders ?? []));
			}

			if (foldersRes.ok) {
				const { data } = await foldersRes.json();
				nodes.push(...adaptDeskFolders(data.folders ?? []));
			}

			if (filesRes.ok) {
				const { data } = await filesRes.json();
				nodes.push(...adaptDeskFiles(data.items ?? []));
			}

			state.setNodes(nodes);
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Failed to load';
		} finally {
			this.loading = false;
		}
	}
}
