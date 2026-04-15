<script lang="ts">
import type { ContextMenuCallbacks } from './context-menu-items';
import type { ExplorerState } from './explorer-state.svelte';
import type { ExplorerNode } from './node';
import TreeNode from './TreeNode.svelte';
import type { UploadingItem } from './types';

interface Props {
	explorerState: ExplorerState;
	uploading: UploadingItem[];
	callbacks: ContextMenuCallbacks;
}

let { explorerState, uploading, callbacks }: Props = $props();

let roots = $derived(explorerState.getRoots());

// Uploading items render at the assets-root level while the root is expanded.
let assetsExpanded = $derived(explorerState.expanded.has('virtual:assets'));

// Roving tabindex cursor — keyboard nav operates on visibleNodes.
function focusNodeById(id: string | null) {
	explorerState.focusedId = id;
}

function currentIndex(visible: ExplorerNode[]): number {
	if (!explorerState.focusedId) return -1;
	return visible.findIndex((n) => n.id === explorerState.focusedId);
}

function handleTreeKeydown(e: KeyboardEvent) {
	// Rename/escape passthrough first.
	if (e.key === 'F2' && explorerState.selectedId) {
		const node = explorerState.getNode(explorerState.selectedId);
		if (node?.capabilities.has('rename')) {
			e.preventDefault();
			explorerState.startRename(explorerState.selectedId);
		}
		return;
	}
	if (e.key === 'Escape') {
		if (explorerState.renamingId) explorerState.cancelRename();
		else if (explorerState.deletingId) explorerState.cancelDelete();
		return;
	}

	// Don't interfere with inline rename inputs.
	if (explorerState.renamingId) return;

	const visible = explorerState.getVisibleNodes();
	if (visible.length === 0) return;
	let idx = currentIndex(visible);
	// First key press: start at selected or root.
	if (idx === -1) {
		idx = explorerState.selectedId ? visible.findIndex((n) => n.id === explorerState.selectedId) : 0;
		if (idx === -1) idx = 0;
	}
	const current = visible[idx];

	switch (e.key) {
		case 'ArrowDown': {
			e.preventDefault();
			const next = visible[Math.min(idx + 1, visible.length - 1)];
			focusNodeById(next.id);
			return;
		}
		case 'ArrowUp': {
			e.preventDefault();
			const prev = visible[Math.max(idx - 1, 0)];
			focusNodeById(prev.id);
			return;
		}
		case 'Home': {
			e.preventDefault();
			focusNodeById(visible[0].id);
			return;
		}
		case 'End': {
			e.preventDefault();
			focusNodeById(visible[visible.length - 1].id);
			return;
		}
		case 'ArrowRight': {
			e.preventDefault();
			if (current.isFolder && !explorerState.expanded.has(current.id)) {
				explorerState.expanded.add(current.id);
			} else if (current.isFolder) {
				// Already expanded → move to first child.
				const children = explorerState.getChildren(current.id);
				if (children.length > 0) focusNodeById(children[0].id);
			}
			return;
		}
		case 'ArrowLeft': {
			e.preventDefault();
			if (current.isFolder && explorerState.expanded.has(current.id)) {
				const next = new Set(explorerState.expanded);
				next.delete(current.id);
				explorerState.expanded = next;
			} else if (current.parentId) {
				focusNodeById(current.parentId);
			}
			return;
		}
		case 'Enter':
		case ' ': {
			e.preventDefault();
			explorerState.selectedId = current.id;
			callbacks.onOpen?.(current);
			return;
		}
		case 'm':
		case 'M': {
			// Panel-scoped shortcut: open "Move to…" for the focused node.
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			if (!current.capabilities.has('move')) return;
			e.preventDefault();
			callbacks.onMoveRequest?.(current);
			return;
		}
	}
}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="explorer-tree"
	role="tree"
	aria-label="Content files"
	tabindex="0"
	onkeydown={handleTreeKeydown}
>
	{#each roots as node (node.id)}
		<TreeNode {node} treeState={explorerState} depth={0} {callbacks} />

		<!-- Inject uploading items inside assets root while the root is expanded. -->
		{#if node.id === 'virtual:assets' && assetsExpanded && uploading.length > 0}
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
