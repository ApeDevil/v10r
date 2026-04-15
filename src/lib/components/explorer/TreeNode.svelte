<script lang="ts">
import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';
import {
	contextMenuContentVariants,
	contextMenuItemVariants,
	contextMenuSeparatorVariants,
} from '$lib/components/composites/context-menu';
import { Badge } from '$lib/components/primitives';
import {
	buildContextMenuItems,
	type ContextMenuCallbacks,
	dispatchMenuAction,
	type MenuEntry,
} from './context-menu-items';
import { isSameVirtualTree, VIRTUAL_ROOT } from './explorer-actions';
import type { ExplorerState } from './explorer-state.svelte';
import type { ExplorerNode } from './node';
import TreeNode from './TreeNode.svelte';

interface Props {
	node: ExplorerNode;
	treeState: ExplorerState;
	depth: number;
	callbacks: ContextMenuCallbacks;
}

let { node, treeState, depth, callbacks }: Props = $props();

let renameInput = $state<HTMLInputElement | null>(null);
let renameValue = $state('');
let renameBlurArmed = false;

let isRenaming = $derived(treeState.renamingId === node.id);
let isDeleting = $derived(treeState.deletingId === node.id);
let isExpanded = $derived(treeState.expanded.has(node.id));
let isSelected = $derived(treeState.selectedId === node.id);
let isFocused = $derived(treeState.focusedId === node.id);
let isAiPinned = $derived(treeState.isAiPinned(node.id));
let children = $derived(node.isFolder ? treeState.getChildren(node.id) : []);
let menuItems = $derived(buildContextMenuItems({ ...node, aiContext: isAiPinned }));

// Auto-focus rename input, delayed to let Bits UI finish focus management
$effect(() => {
	if (isRenaming && renameInput) {
		renameValue = node.label;
		renameBlurArmed = false;
		requestAnimationFrame(() => {
			if (renameInput) {
				renameInput.focus();
				renameInput.select();
				// Arm blur-commit only after focus is stable
				requestAnimationFrame(() => {
					renameBlurArmed = true;
				});
			}
		});
	}
});

function commitRename() {
	if (!renameBlurArmed) return;
	renameBlurArmed = false;
	const trimmed = renameValue.trim();
	if (trimmed && trimmed !== node.label) {
		callbacks.onRename?.(Object.assign({}, node, { label: trimmed }));
	}
	treeState.cancelRename();
}

function handleRenameKeydown(e: KeyboardEvent) {
	if (e.key === 'Enter') {
		e.preventDefault();
		(e.currentTarget as HTMLInputElement).blur();
	} else if (e.key === 'Escape') {
		e.stopPropagation();
		treeState.cancelRename();
	}
}

function handleMenuAction(action: string) {
	if (action === 'rename') {
		// Delay so Bits UI context menu focus management completes before input renders
		setTimeout(() => treeState.startRename(node.id), 0);
		return;
	}
	if (action === 'delete') {
		treeState.startDelete(node.id);
		return;
	}
	dispatchMenuAction(action, node, callbacks);
}

function handleDragStart(e: DragEvent) {
	if (!e.dataTransfer) return;
	e.dataTransfer.setData('application/x-explorer-node', node.id);
	e.dataTransfer.effectAllowed = 'move';
	// Shared state for cross-node cycle checks — Firefox can't read getData() in dragover.
	treeState.draggingId = node.id;

	// For assets, also set the markdown data for editor drops
	if (node.source === 'blog-asset') {
		const data = node.sourceData as Record<string, unknown>;
		const alt = (data.altText as string) || node.label.replace(/\.[^.]+$/, '');
		const imageUrl = `/api/blog/assets/${node.id}/image`;
		e.dataTransfer.setData('text/plain', `![${alt}](${imageUrl})`);
		e.dataTransfer.setData('application/x-explorer-asset', JSON.stringify({ id: node.id, altText: alt }));
		e.dataTransfer.effectAllowed = 'copy';
	}
}

function handleDragEnd() {
	treeState.draggingId = null;
	dragOver = false;
	clearExpandTimer();
}

let dragOver = $state(false);
// Plain reference — not $state — since the timer handle isn't rendered.
let expandTimer: ReturnType<typeof setTimeout> | null = null;

function clearExpandTimer() {
	if (expandTimer) {
		clearTimeout(expandTimer);
		expandTimer = null;
	}
}

function isValidDropTarget(): boolean {
	if (!node.isFolder) return false;
	const draggingId = treeState.draggingId;
	if (!draggingId) return false;
	const dragged = treeState.getNode(draggingId);
	if (!dragged) return false;
	// Cross-root moves forbidden (silent ignore — no highlight, system no-drop cursor only).
	if (!isSameVirtualTree(dragged, node)) return false;
	// Virtual root of the dragged item accepts its own content types as drop target.
	if (node.source === 'virtual' && node.id === VIRTUAL_ROOT[dragged.source]) {
		return dragged.parentId !== node.id;
	}
	if (node.source === 'virtual') return false;
	// Can't drop onto self or any descendant (matches server-side cycle detection).
	return !treeState.isCycleMove(draggingId, node.id);
}

function handleDragOver(e: DragEvent) {
	if (!e.dataTransfer?.types.includes('application/x-explorer-node')) return;
	if (!isValidDropTarget()) {
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
		return;
	}
	e.preventDefault();
	e.dataTransfer.dropEffect = 'move';
	dragOver = true;

	// Expand-on-hover: if hovering a collapsed folder for 600ms, auto-expand.
	// Only expand — never collapse — to keep drop targets stable during drag.
	if (!isExpanded && !expandTimer) {
		expandTimer = setTimeout(() => {
			treeState.expanded.add(node.id);
			expandTimer = null;
		}, 600);
	}
}

function handleDragLeave() {
	dragOver = false;
	clearExpandTimer();
}

function handleDrop(e: DragEvent) {
	e.preventDefault();
	dragOver = false;
	clearExpandTimer();
	const draggedId = e.dataTransfer?.getData('application/x-explorer-node') || treeState.draggingId;
	treeState.draggingId = null;
	if (!draggedId || draggedId === node.id) return;
	if (treeState.isCycleMove(draggedId, node.id)) return;
	// Expand the drop target so the user can see where the node landed.
	if (!treeState.expanded.has(node.id)) treeState.expanded.add(node.id);
	callbacks.onMove?.(draggedId, node.id);
}

const paddingLeft = $derived(8 + depth * 16);
const descendantCount = $derived(node.isFolder ? treeState.countDescendants(node.id) : 0);
</script>

<ContextMenuPrimitive.Root>
	<ContextMenuPrimitive.Trigger class="tree-ctx-trigger">
		{#snippet child({ props })}
			{#if node.isFolder}
				<button
					{...props}
					class="tree-folder"
					class:drag-over={dragOver}
					class:tree-focused={isFocused}
					class:tree-selected={isSelected}
					style="padding-left: {paddingLeft}px"
					role="treeitem"
					aria-expanded={isExpanded}
					aria-selected={isSelected}
					draggable={node.capabilities.has('move') ? 'true' : undefined}
					ondragstart={handleDragStart}
					ondragend={handleDragEnd}
					ondragover={handleDragOver}
					ondragleave={handleDragLeave}
					ondrop={handleDrop}
					onclick={() => {
						treeState.selectedId = node.id;
						treeState.toggleExpanded(node.id);
					}}
				>
					<span class="tree-toggle">{isExpanded ? '▾' : '▸'}</span>
					<span class="{node.icon} tree-icon" style:color={node.iconColor}></span>
					{#if isRenaming}
						<input
							bind:this={renameInput}
							bind:value={renameValue}
							class="rename-input"
							onblur={commitRename}
							onkeydown={handleRenameKeydown}
							onclick={(e) => e.stopPropagation()}
						/>
					{:else}
						<span class="tree-label">{node.label}</span>
					{/if}
					{#if children.length > 0}
						<span class="tree-count">{children.length}</span>
					{:else if node.childCount != null && node.childCount >= 0}
						<span class="tree-count">{node.childCount}</span>
					{/if}
				</button>
			{:else}
				<div
					{...props}
					class="tree-file"
					class:tree-selected={isSelected}
					class:tree-focused={isFocused}
					style="padding-left: {paddingLeft}px"
					role="treeitem"
					aria-selected={isSelected}
					tabindex={-1}
					draggable={node.capabilities.has('move') || node.source === 'blog-asset' ? 'true' : undefined}
					ondragstart={handleDragStart}
					ondragend={handleDragEnd}
					ondragover={handleDragOver}
					ondragleave={handleDragLeave}
					ondrop={handleDrop}
				>
					<button class="tree-file-btn" onclick={() => callbacks.onOpen?.(node)}>
						<span class="tree-toggle"></span>
						<span class="{node.icon} tree-icon" style:color={node.iconColor}></span>
						{#if isRenaming}
							<input
								bind:this={renameInput}
								bind:value={renameValue}
								class="rename-input"
								onblur={commitRename}
								onkeydown={handleRenameKeydown}
								onclick={(e) => e.stopPropagation()}
							/>
						{:else}
							<span class="tree-file-info">
								<span class="tree-file-name">{node.label}</span>
								{#if node.badge || node.subtitle}
									<span class="tree-file-meta">
										{#if node.badge}
											<Badge variant={node.badge.variant}>{node.badge.text}</Badge>
										{/if}
										{#if node.subtitle}
											<span class="tree-file-title">{node.subtitle}</span>
										{/if}
									</span>
								{/if}
							</span>
						{/if}
					</button>
					{#if node.capabilities.has('ai-context')}
						<button
							class="tree-action ai-pin"
							class:ai-pinned={isAiPinned}
							onclick={(e) => { e.stopPropagation(); callbacks.onToggleAiContext?.(node); }}
							title={isAiPinned ? 'Unpin from AI Context' : 'Pin to AI Context'}
							aria-label={isAiPinned ? 'Unpin from AI Context' : 'Pin to AI Context'}
						>
							<span class={isAiPinned ? 'i-lucide-pin-off' : 'i-lucide-pin'}></span>
						</button>
					{/if}
				</div>
			{/if}
		{/snippet}
	</ContextMenuPrimitive.Trigger>

	{#if menuItems.length > 0}
		<ContextMenuPrimitive.Portal>
			<ContextMenuPrimitive.Content class={contextMenuContentVariants()}>
				{#each menuItems as item}
					{#if item.type === 'separator'}
						<ContextMenuPrimitive.Separator class={contextMenuSeparatorVariants()} />
					{:else}
						<ContextMenuPrimitive.Item
							class={contextMenuItemVariants()}
							onclick={() => handleMenuAction(item.action)}
						>
							<span class="{item.icon} ctx-icon"></span>
							{item.label}
						</ContextMenuPrimitive.Item>
					{/if}
				{/each}
			</ContextMenuPrimitive.Content>
		</ContextMenuPrimitive.Portal>
	{/if}
</ContextMenuPrimitive.Root>

{#if isDeleting}
	<div class="delete-strip" style="padding-left: {paddingLeft}px" role="alert">
		<span class="delete-strip-text">
			{#if node.isFolder && descendantCount > 0}
				Delete "{node.label}" and {descendantCount} item{descendantCount === 1 ? '' : 's'}?
			{:else}
				Delete "{node.label}"?
			{/if}
		</span>
		<button class="delete-strip-btn delete-strip-confirm" onclick={() => callbacks.onDelete?.(node)}>
			{node.isFolder && descendantCount > 0 ? 'Delete All' : 'Delete'}
		</button>
		<button class="delete-strip-btn delete-strip-cancel" onclick={() => treeState.cancelDelete()}>
			Cancel
		</button>
	</div>
{/if}

{#if node.isFolder && isExpanded}
	{#if children.length === 0}
		<div class="tree-empty" style="padding-left: {paddingLeft + 16}px">
			<span>No files yet</span>
		</div>
	{:else}
		{#each children as child (child.id)}
			<TreeNode node={child} {treeState} depth={depth + 1} {callbacks} />
		{/each}
	{/if}
{/if}

<style>
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

	.tree-folder.drag-over {
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
		box-shadow: inset 3px 0 0 var(--color-primary);
	}

	.tree-folder.tree-focused,
	.tree-file.tree-focused {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
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
		padding: 3px 8px 3px 0;
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

	.tree-action.ai-pinned {
		display: flex;
		color: var(--color-primary);
	}

	.tree-empty {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px;
		font-size: 12px;
		color: var(--color-muted);
	}

	.rename-input {
		flex: 1;
		min-width: 0;
		padding: 1px 4px;
		font-size: 13px;
		border: 1px solid var(--color-primary);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-fg);
		outline: none;
	}

	.delete-strip {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		font-size: 12px;
		background: var(--color-error-bg);
		color: var(--color-error);
	}

	.delete-strip-text {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.delete-strip-btn {
		padding: 2px 8px;
		font-size: 11px;
		font-weight: 500;
		border-radius: var(--radius-sm);
		border: none;
		cursor: pointer;
		white-space: nowrap;
	}

	.delete-strip-confirm {
		background: var(--color-error);
		color: white;
	}

	.delete-strip-confirm:hover {
		opacity: 0.9;
	}

	.delete-strip-cancel {
		background: transparent;
		color: var(--color-fg);
		border: 1px solid var(--color-border);
	}

	.delete-strip-cancel:hover {
		background: var(--surface-2);
	}

	/* Context menu trigger must not add layout */
	:global(.tree-ctx-trigger) {
		display: contents;
	}

	.ctx-icon {
		font-size: 14px;
		flex-shrink: 0;
	}

	:global([data-context-menu-content] [role='menuitem'][data-highlighted]) {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}
</style>
