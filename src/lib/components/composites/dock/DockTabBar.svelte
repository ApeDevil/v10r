<script lang="ts">
import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';
import { cn } from '$lib/utils/cn';
import {
	contextMenuContentVariants,
	contextMenuItemVariants,
	contextMenuSeparatorVariants,
} from '$lib/components/composites/context-menu';
import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
import { getDockContext } from './dock.state.svelte';
import type { LeafNode } from './dock.types';
import DockLeafMenu from './DockLeafMenu.svelte';
import DockLeafHelp from './DockLeafHelp.svelte';

interface Props {
	leaf: LeafNode;
	isFocused?: boolean;
	menus?: MenuBarMenu[];
	panelType?: string | null;
	class?: string;
}

let { leaf, isFocused = false, menus = [], panelType = null, class: className }: Props = $props();

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

function handleDocumentPointerUp(_e: PointerEvent) {
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
	aria-label="Panel tabs"
>
	<div class="dock-tab-scroll" role="tablist">
	{#each leaf.tabs as panelId, i (panelId)}
		{@const panel = dock.panels[panelId]}
		{@const isActive = leaf.activeTab === panelId}
		{@const isDragging = dock.dragState?.panelId === panelId}
		{#if panel}
			<ContextMenuPrimitive.Root>
				<ContextMenuPrimitive.Trigger class="dock-tab-ctx-trigger">
					{#snippet child({ props })}
						<button
							{...props}
							role="tab"
							aria-selected={isActive}
							tabindex={isActive ? 0 : -1}
							class={cn(
								'dock-tab',
								isActive && 'active',
								isDragging && 'dragging'
							)}
							aria-label={panel.indicator ? `${panel.label} (${panel.indicator})` : panel.label}
							onpointerdown={(e) => handlePointerDown(e, panelId)}
							onkeydown={(e) => handleKeyDown(e, panelId, i)}
						>
							{#if panel.icon}
								<span class={cn('dock-tab-icon', panel.icon)}></span>
							{/if}
							<span class="dock-tab-label">{panel.label}</span>
							{#if panel.indicator}
								<span
									class={cn('dock-tab-dot', `dot-${panel.indicator}`)}
									aria-hidden="true"
								></span>
							{/if}
							{#if panel.closable !== false}
								<span
									role="button"
									data-close-btn
									class="dock-tab-close"
									aria-label="Close {panel.label}"
									tabindex={-1}
									onclick={(e) => handleClose(e, panelId)}
									onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); dock.closePanel(panelId); } }}
								>
									<span class="i-lucide-x"></span>
								</span>
							{/if}
						</button>
					{/snippet}
				</ContextMenuPrimitive.Trigger>

				<ContextMenuPrimitive.Portal>
					<ContextMenuPrimitive.Content class={contextMenuContentVariants()}>
						<ContextMenuPrimitive.Item
							class={contextMenuItemVariants()}
							onclick={() => dock.closePanel(panelId)}
						>
							<span class="i-lucide-x ctx-icon"></span>
							Close
						</ContextMenuPrimitive.Item>
						<ContextMenuPrimitive.Item
							class={contextMenuItemVariants()}
							disabled={leaf.tabs.length <= 1}
							onclick={() => dock.closeOtherPanels(leaf.id, panelId)}
						>
							<span class="i-lucide-x-circle ctx-icon"></span>
							Close Others
						</ContextMenuPrimitive.Item>
						<ContextMenuPrimitive.Item
							class={contextMenuItemVariants()}
							onclick={() => dock.closeAllPanels(leaf.id)}
						>
							<span class="i-lucide-x-square ctx-icon"></span>
							Close All
						</ContextMenuPrimitive.Item>
						<ContextMenuPrimitive.Separator class={contextMenuSeparatorVariants()} />
						<ContextMenuPrimitive.Item
							class={contextMenuItemVariants()}
							onclick={() => dock.addPanel(
								{ id: `${panel.type}-${Date.now()}`, type: panel.type, label: panel.label, icon: panel.icon, closable: true },
								{ leafId: leaf.id, zone: 'right' },
							)}
						>
							<span class="i-lucide-columns-2 ctx-icon"></span>
							Split Right
						</ContextMenuPrimitive.Item>
						<ContextMenuPrimitive.Item
							class={contextMenuItemVariants()}
							onclick={() => dock.addPanel(
								{ id: `${panel.type}-${Date.now()}`, type: panel.type, label: panel.label, icon: panel.icon, closable: true },
								{ leafId: leaf.id, zone: 'bottom' },
							)}
						>
							<span class="i-lucide-rows-2 ctx-icon"></span>
							Split Down
						</ContextMenuPrimitive.Item>
					</ContextMenuPrimitive.Content>
				</ContextMenuPrimitive.Portal>
			</ContextMenuPrimitive.Root>
		{/if}
	{/each}
	</div>
	{#if isFocused}
		<div class="dock-tab-actions">
			<DockLeafHelp {panelType} />
			<DockLeafMenu {menus} />
		</div>
	{/if}
</div>

<style>
	.dock-tab-bar {
		display: flex;
		align-items: stretch;
		gap: 0;
		background: var(--color-bg);
		border-bottom: 1px solid var(--color-border);
		min-height: 32px;
		user-select: none;
	}

	.dock-tab-scroll {
		display: flex;
		align-items: stretch;
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.dock-tab-scroll::-webkit-scrollbar {
		display: none;
	}

	.dock-tab-actions {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		border-left: 1px solid var(--color-border);
		padding: 0 2px;
		gap: 1px;
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

	/* Context menu trigger must not add layout */
	:global(.dock-tab-ctx-trigger) {
		display: contents;
	}

	.dock-tab-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.dock-tab-dot.dot-unsaved {
		background: var(--color-warning, #f59e0b);
	}

	.dock-tab-dot.dot-saving {
		background: var(--color-muted);
		animation: dot-pulse 1s ease-in-out infinite;
	}

	.dock-tab-dot.dot-error {
		background: var(--color-error);
	}

	@keyframes dot-pulse {
		50% { opacity: 0.3; }
	}

	.ctx-icon {
		font-size: 14px;
		flex-shrink: 0;
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

	/* Context menu highlight — same fix as ContextMenu.svelte */
	:global([data-context-menu-content] [role='menuitem'][data-highlighted]) {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}
</style>
