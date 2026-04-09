<script lang="ts">
import type { ContextMenuCallbacks } from './context-menu-items';
import type { ExplorerState } from './explorer-state.svelte';
import TreeNode from './TreeNode.svelte';
import type { UploadingItem } from './types';

interface Props {
	explorerState: ExplorerState;
	uploading: UploadingItem[];
	callbacks: ContextMenuCallbacks;
}

let { explorerState, uploading, callbacks }: Props = $props();

let roots = $derived(explorerState.getRoots());

// Uploading items need to render inside the virtual:images folder
let imagesExpanded = $derived(explorerState.expanded.has('virtual:images'));

function handleTreeKeydown(e: KeyboardEvent) {
	if (e.key === 'F2' && explorerState.selectedId) {
		const node = explorerState.getNode(explorerState.selectedId);
		if (node?.capabilities.has('rename')) {
			e.preventDefault();
			explorerState.startRename(explorerState.selectedId);
		}
	}
	if (e.key === 'Escape') {
		if (explorerState.renamingId) explorerState.cancelRename();
		else if (explorerState.deletingId) explorerState.cancelDelete();
	}
}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="explorer-tree" role="tree" aria-label="Content files" tabindex="0" onkeydown={handleTreeKeydown}>
	{#each roots as node (node.id)}
		<TreeNode {node} treeState={explorerState} depth={0} {callbacks} />

		<!-- Inject uploading items inside images folder -->
		{#if node.id === 'virtual:assets' && imagesExpanded && uploading.length > 0}
			{#each uploading as u (u.id)}
				<div class="tree-file-uploading" style="padding-left: 56px" role="treeitem" aria-selected={false}>
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
		{/if}
	{/each}
</div>

<style>
	.explorer-tree {
		flex: 1;
		overflow-y: auto;
		padding: 4px 0;
	}

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

	.tree-file-uploading {
		padding: 3px 8px;
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 13px;
		color: var(--color-muted);
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

	.tree-file-error {
		font-size: 11px;
		color: var(--color-error);
	}
</style>
