<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { getDockContext } from './dock.state.svelte';
	import type { LeafNode } from './dock.types';

	interface Props {
		leaf: LeafNode;
		class?: string;
	}

	let { leaf, class: className }: Props = $props();

	const dock = getDockContext();

	function handleClose(e: MouseEvent, panelId: string) {
		e.stopPropagation();
		dock.closePanel(panelId);
	}

	// --- Drag source ---
	let dragId = $state<string | null>(null);
	let ghostEl = $state<HTMLElement | null>(null);
	let startX = 0;
	let startY = 0;
	let didDrag = false;
	const DRAG_THRESHOLD = 5;

	function handlePointerDown(e: PointerEvent, panelId: string) {
		if (e.button !== 0) return;
		if ((e.target as HTMLElement).closest('[data-close-btn]')) return;

		e.preventDefault();
		dragId = panelId;
		startX = e.clientX;
		startY = e.clientY;
		didDrag = false;

		// Use document-level listeners so drag works across leaves
		document.addEventListener('pointermove', handleDocumentPointerMove);
		document.addEventListener('pointerup', handleDocumentPointerUp);
	}

	function handleDocumentPointerMove(e: PointerEvent) {
		if (!dragId) return;

		const dx = e.clientX - startX;
		const dy = e.clientY - startY;

		if (!didDrag && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;

		if (!didDrag) {
			didDrag = true;
			dock.startDrag(dragId, leaf.id);
			createGhost(e);
		}

		if (ghostEl) {
			ghostEl.style.left = `${e.clientX - 40}px`;
			ghostEl.style.top = `${e.clientY - 12}px`;
		}
	}

	function handleDocumentPointerUp(e: PointerEvent) {
		document.removeEventListener('pointermove', handleDocumentPointerMove);
		document.removeEventListener('pointerup', handleDocumentPointerUp);

		if (!dragId) return;

		if (didDrag) {
			dock.endDrag();
			removeGhost();
		} else {
			dock.activateTab(leaf.id, dragId);
		}

		dragId = null;
		didDrag = false;
	}

	function handleKeyDown(e: KeyboardEvent, panelId: string, index: number) {
		if (e.key === 'Escape' && dock.dragState) {
			dock.cancelDrag();
			removeGhost();
			document.removeEventListener('pointermove', handleDocumentPointerMove);
			document.removeEventListener('pointerup', handleDocumentPointerUp);
			dragId = null;
			didDrag = false;
			return;
		}

		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			dock.activateTab(leaf.id, panelId);
			return;
		}

		if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
			const dir = e.key === 'ArrowLeft' ? -1 : 1;
			const newIndex = index + dir;
			if (newIndex >= 0 && newIndex < leaf.tabs.length) {
				dock.reorderTab(leaf.id, panelId, newIndex);
				requestAnimationFrame(() => {
					const tabBar = (e.currentTarget as HTMLElement).parentElement;
					const tabs = tabBar?.querySelectorAll<HTMLElement>('[role="tab"]');
					tabs?.[newIndex]?.focus();
				});
			}
		}
	}

	function createGhost(e: PointerEvent) {
		const panel = dock.panels[dragId!];
		if (!panel) return;

		const ghost = document.createElement('div');
		ghost.className = 'dock-drag-ghost';
		ghost.textContent = panel.label;
		ghost.style.cssText = `
			position: fixed;
			left: ${e.clientX - 40}px;
			top: ${e.clientY - 12}px;
			padding: 4px 12px;
			background: var(--surface-2);
			border: 1px solid var(--color-border);
			border-radius: var(--radius-md);
			font-size: 0.75rem;
			color: var(--color-fg);
			pointer-events: none;
			z-index: 9999;
			box-shadow: var(--shadow-lg);
			opacity: 0.9;
		`;
		document.body.appendChild(ghost);
		ghostEl = ghost;
	}

	function removeGhost() {
		if (ghostEl) {
			ghostEl.remove();
			ghostEl = null;
		}
	}
</script>

<div
	class={cn('dock-tab-bar', className)}
	role="tablist"
	aria-label="Panel tabs"
>
	{#each leaf.tabs as panelId, i (panelId)}
		{@const panel = dock.panels[panelId]}
		{@const isActive = leaf.activeTab === panelId}
		{@const isDragging = dock.dragState?.panelId === panelId}
		{#if panel}
			<button
				role="tab"
				aria-selected={isActive}
				tabindex={isActive ? 0 : -1}
				class={cn(
					'dock-tab',
					isActive && 'active',
					isDragging && 'dragging'
				)}
				onpointerdown={(e) => handlePointerDown(e, panelId)}
				onkeydown={(e) => handleKeyDown(e, panelId, i)}
			>
				{#if panel.icon}
					<span class={cn('dock-tab-icon', panel.icon)}></span>
				{/if}
				<span class="dock-tab-label">{panel.label}</span>
				{#if panel.closable !== false}
					<button
						data-close-btn
						class="dock-tab-close"
						aria-label="Close {panel.label}"
						tabindex={-1}
						onclick={(e) => handleClose(e, panelId)}
					>
						<span class="i-lucide-x"></span>
					</button>
				{/if}
			</button>
		{/if}
	{/each}
</div>

<style>
	.dock-tab-bar {
		display: flex;
		align-items: stretch;
		gap: 0;
		background: var(--surface-0);
		border-bottom: 1px solid var(--color-border);
		min-height: 32px;
		overflow-x: auto;
		scrollbar-width: none;
		user-select: none;
	}

	.dock-tab-bar::-webkit-scrollbar {
		display: none;
	}

	.dock-tab {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 10px;
		font-size: 0.75rem;
		line-height: 1;
		color: var(--color-muted);
		background: transparent;
		border: none;
		border-right: 1px solid var(--color-border);
		white-space: nowrap;
		cursor: pointer;
		position: relative;
		touch-action: none;
	}

	.dock-tab:hover {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-fg) 5%, transparent);
	}

	.dock-tab.active {
		color: var(--color-fg);
		background: var(--surface-1);
		border-bottom: 2px solid var(--color-primary);
	}

	.dock-tab.dragging {
		opacity: 0.4;
	}

	.dock-tab:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.dock-tab-icon {
		font-size: 14px;
		flex-shrink: 0;
	}

	.dock-tab-label {
		flex: 1;
		min-width: 0;
	}

	.dock-tab-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: var(--radius-sm);
		opacity: 0;
		flex-shrink: 0;
		font-size: 12px;
	}

	.dock-tab:hover .dock-tab-close,
	.dock-tab.active .dock-tab-close {
		opacity: 0.6;
	}

	.dock-tab-close:hover {
		opacity: 1 !important;
		background: color-mix(in srgb, var(--color-fg) 15%, transparent);
	}
</style>
