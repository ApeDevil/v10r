<script lang="ts">
	import { Badge } from '$lib/components/primitives';
	import type { AssetListItem, PostListItem, UploadingItem } from './types';

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		const value = bytes / 1024 ** i;
		return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
	}

	interface Props {
		posts: PostListItem[];
		assets: AssetListItem[];
		uploading: UploadingItem[];
		expandedFolders: Set<string>;
		selectedAssetId: string | null;
		ontogglefolder: (folder: string) => void;
		onselectpost: (post: PostListItem) => void;
		onselectasset: (asset: AssetListItem) => void;
		onexportpost: (post: PostListItem) => void;
		ondeleteasset: (asset: AssetListItem) => void;
	}

	let {
		posts,
		assets,
		uploading,
		expandedFolders,
		selectedAssetId,
		ontogglefolder,
		onselectpost,
		onselectasset,
		onexportpost,
		ondeleteasset,
	}: Props = $props();

	function statusVariant(status: string): 'success' | 'secondary' | 'warning' {
		if (status === 'published') return 'success';
		if (status === 'archived') return 'warning';
		return 'secondary';
	}

	function handleDragStart(e: DragEvent, asset: AssetListItem) {
		if (!e.dataTransfer) return;
		const alt = asset.altText || asset.fileName.replace(/\.[^.]+$/, '');
		const markdown = `![${alt}](${asset.downloadUrl})`;
		e.dataTransfer.setData('text/plain', markdown);
		e.dataTransfer.setData(
			'application/x-explorer-asset',
			JSON.stringify({
				assetId: asset.id,
				fileName: asset.fileName,
				downloadUrl: asset.downloadUrl,
				altText: alt,
			}),
		);
		e.dataTransfer.effectAllowed = 'copy';
	}
</script>

<div class="explorer-tree" role="tree" aria-label="Content files">
	<!-- Blog folder -->
	<button
		class="tree-folder tree-depth-0"
		role="treeitem"
		aria-selected={false}
		aria-expanded={expandedFolders.has('blog')}
		onclick={() => ontogglefolder('blog')}
	>
		<span class="tree-toggle">{expandedFolders.has('blog') ? '▾' : '▸'}</span>
		<span class="i-lucide-book-open tree-icon tree-icon-blog"></span>
		<span class="tree-label">blog</span>
		<span class="tree-count">{posts.length}</span>
	</button>

	{#if expandedFolders.has('blog')}
		{#if posts.length === 0}
			<div class="tree-empty tree-depth-1">
				<span class="i-lucide-pen-line tree-empty-icon"></span>
				<span>No posts yet</span>
			</div>
		{:else}
			{#each posts as p (p.id)}
				<div class="tree-file tree-depth-1 tree-file-post" role="treeitem" aria-selected={false}>
					<button class="tree-file-btn" onclick={() => onselectpost(p)}>
						<span class="tree-toggle"></span>
						<span class="i-lucide-file-text tree-icon tree-icon-md"></span>
						<span class="tree-file-info">
							<span class="tree-file-name">{p.slug}.md</span>
							<span class="tree-file-meta">
								<Badge variant={statusVariant(p.status)}>{p.status}</Badge>
								<span class="tree-file-title">{p.title || '(untitled)'}</span>
							</span>
						</span>
					</button>
					<button
						class="tree-action"
						onclick={(e) => { e.stopPropagation(); onexportpost(p); }}
						title="Download .md"
						aria-label="Download {p.slug}.md"
					>
						<span class="i-lucide-download"></span>
					</button>
				</div>
			{/each}
		{/if}
	{/if}

	<!-- Assets folder -->
	<button
		class="tree-folder tree-depth-0"
		role="treeitem"
		aria-selected={false}
		aria-expanded={expandedFolders.has('assets')}
		onclick={() => ontogglefolder('assets')}
	>
		<span class="tree-toggle">{expandedFolders.has('assets') ? '▾' : '▸'}</span>
		<span class="i-lucide-layers tree-icon tree-icon-assets"></span>
		<span class="tree-label">assets</span>
	</button>

	{#if expandedFolders.has('assets')}
		<!-- Images sub-folder -->
		<button
			class="tree-folder tree-depth-1"
			role="treeitem"
			aria-selected={false}
			aria-expanded={expandedFolders.has('images')}
			onclick={() => ontogglefolder('images')}
		>
			<span class="tree-toggle">{expandedFolders.has('images') ? '▾' : '▸'}</span>
			<span class="i-lucide-image tree-icon tree-icon-folder"></span>
			<span class="tree-label">images</span>
			<span class="tree-count">{assets.length + uploading.length}</span>
		</button>

		{#if expandedFolders.has('images')}
			{#each uploading as u (u.id)}
				<div class="tree-file tree-depth-2 tree-file-uploading" role="treeitem" aria-selected={false}>
					<span class="tree-toggle"></span>
					{#if u.status === 'uploading'}
						<span class="i-lucide-loader-2 tree-icon tree-icon-spin"></span>
					{:else}
						<span class="i-lucide-alert-triangle tree-icon tree-icon-error"></span>
					{/if}
					<span class="tree-file-info">
						<span class="tree-file-name">{u.fileName}</span>
						{#if u.error}
							<span class="tree-file-error">{u.error}</span>
						{/if}
					</span>
				</div>
			{/each}

			{#if assets.length === 0 && uploading.length === 0}
				<div class="tree-empty tree-depth-2">
					<span class="i-lucide-upload tree-empty-icon"></span>
					<span>No images yet</span>
				</div>
			{:else}
				{#each assets as a (a.id)}
					<div
						class="tree-file tree-depth-2"
						class:tree-selected={selectedAssetId === a.id}
						role="treeitem"
						aria-selected={selectedAssetId === a.id}
						tabindex={0}
					draggable="true"
						ondragstart={(e) => handleDragStart(e, a)}
					>
						<button class="tree-file-btn" onclick={() => onselectasset(a)}>
							<span class="tree-toggle"></span>
							<span class="i-lucide-image tree-icon tree-icon-image"></span>
							<span class="tree-file-name">{a.fileName}</span>
							<span class="tree-file-size">{formatBytes(a.fileSize)}</span>
						</button>
						<button
							class="tree-action"
							onclick={(e) => { e.stopPropagation(); ondeleteasset(a); }}
							title="Delete"
							aria-label="Delete {a.fileName}"
						>
							<span class="i-lucide-trash-2"></span>
						</button>
					</div>
				{/each}
			{/if}
		{/if}
	{/if}
</div>

<style>
	.explorer-tree {
		flex: 1;
		overflow-y: auto;
		padding: 4px 0;
	}

	.tree-folder {
		display: flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		padding: 4px 8px;
		border: none;
		background: transparent;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
		color: var(--color-fg);
		text-align: left;
	}

	.tree-folder:hover {
		background: color-mix(in srgb, var(--surface-2) 60%, transparent);
	}

	.tree-depth-0 { padding-left: 8px; }
	.tree-depth-1 { padding-left: 24px; }
	.tree-depth-2 { padding-left: 40px; }

	.tree-toggle {
		width: 14px;
		font-size: 10px;
		text-align: center;
		color: var(--color-muted);
		flex-shrink: 0;
	}

	.tree-icon {
		font-size: 15px;
		flex-shrink: 0;
	}

	.tree-icon-blog {
		color: var(--color-primary);
	}

	.tree-icon-assets {
		color: var(--color-muted);
	}

	.tree-icon-folder {
		color: var(--color-warning, #d4a72c);
	}

	.tree-icon-md {
		color: var(--color-primary);
	}

	.tree-icon-image {
		color: var(--color-success, #22c55e);
	}

	.tree-icon-spin {
		color: var(--color-primary);
		animation: spin 1s linear infinite;
	}

	.tree-icon-error {
		color: var(--color-error);
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.tree-label {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tree-count {
		font-size: 11px;
		color: var(--color-muted);
		margin-left: auto;
		flex-shrink: 0;
	}

	.tree-file {
		display: flex;
		align-items: center;
		position: relative;
	}

	.tree-file-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		padding: 3px 8px;
		border: none;
		background: transparent;
		cursor: pointer;
		font-size: 13px;
		color: var(--color-fg);
		text-align: left;
	}

	.tree-file:hover {
		background: color-mix(in srgb, var(--surface-2) 60%, transparent);
	}

	.tree-file.tree-selected {
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
	}

	.tree-file-post .tree-file-btn {
		padding: 5px 8px;
	}

	.tree-file-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
		gap: 1px;
	}

	.tree-file-name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 13px;
	}

	.tree-file-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
	}

	.tree-file-title {
		color: var(--color-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tree-file-size {
		font-size: 11px;
		color: var(--color-muted);
		margin-left: auto;
		flex-shrink: 0;
	}

	.tree-file-error {
		font-size: 11px;
		color: var(--color-error);
	}

	.tree-file-uploading {
		padding: 3px 8px;
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 13px;
		color: var(--color-muted);
	}

	.tree-action {
		display: none;
		align-items: center;
		justify-content: center;
		position: absolute;
		right: 6px;
		width: 22px;
		height: 22px;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
		font-size: 13px;
		border: none;
	}

	.tree-file:hover .tree-action {
		display: flex;
	}

	.tree-action:hover {
		background: var(--surface-2);
		color: var(--color-fg);
	}

	.tree-empty {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px;
		font-size: 12px;
		color: var(--color-muted);
	}

	.tree-empty-icon {
		font-size: 14px;
		opacity: 0.5;
	}
</style>
