<script lang="ts">
import { onMount, tick } from 'svelte';
import { browser } from '$app/environment';
import { cn } from '$lib/utils/cn';
import type { PaneDefinition } from './reorderable-panes';
import { gripVariants, tabBarVariants, tabVariants } from './reorderable-panes';

interface Props {
	panes: PaneDefinition[];
	order: string[];
	direction?: 'horizontal' | 'vertical';
	onReorder: (newOrder: string[]) => void;
	class?: string;
}

let { panes, order, direction = 'horizontal', onReorder, class: className }: Props = $props();

let paneMap = $derived(Object.fromEntries(panes.map((p) => [p.id, p])) as Record<string, PaneDefinition>);

// Drag state
let dragId = $state<string | null>(null);
let ghostEl = $state<HTMLElement | null>(null);
let dropIndex = $state<number | null>(null);
let barEl = $state<HTMLElement | null>(null);
let mounted = $state(false);

// Announcement for screen readers
let announcement = $state('');

onMount(() => {
	mounted = true;
});

function getTabElements(): HTMLElement[] {
	if (!barEl) return [];
	return Array.from(barEl.querySelectorAll('[data-tab-id]'));
}

function getDropIndex(clientPos: number): number {
	const tabs = getTabElements();
	const isHorizontal = direction === 'horizontal';

	for (let i = 0; i < tabs.length; i++) {
		const rect = tabs[i].getBoundingClientRect();
		const mid = isHorizontal ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
		if (clientPos < mid) return i;
	}
	return tabs.length;
}

function createGhost(sourceEl: HTMLElement, x: number, y: number) {
	const rect = sourceEl.getBoundingClientRect();
	const ghost = sourceEl.cloneNode(true) as HTMLElement;
	ghost.style.position = 'fixed';
	ghost.style.width = `${rect.width}px`;
	ghost.style.height = `${rect.height}px`;
	ghost.style.left = `${x - rect.width / 2}px`;
	ghost.style.top = `${y - rect.height / 2}px`;
	ghost.style.pointerEvents = 'none';
	ghost.style.zIndex = '9999';
	ghost.style.opacity = '0.8';
	ghost.style.transition = 'none';
	ghost.removeAttribute('data-tab-id');
	ghost.classList.add('tab-ghost');
	document.body.appendChild(ghost);
	return ghost;
}

function handlePointerDown(e: PointerEvent, id: string) {
	if (!mounted || !browser) return;
	e.preventDefault();

	const grip = e.currentTarget as HTMLElement;
	const tab = grip.closest('[data-tab-id]') as HTMLElement;
	if (!tab) return;

	grip.setPointerCapture(e.pointerId);
	dragId = id;

	const clientPos = direction === 'horizontal' ? e.clientX : e.clientY;
	dropIndex = getDropIndex(clientPos);
	ghostEl = createGhost(tab, e.clientX, e.clientY);
}

function handlePointerMove(e: PointerEvent) {
	if (!dragId || !ghostEl) return;

	requestAnimationFrame(() => {
		if (!ghostEl) return;
		const rect = ghostEl.getBoundingClientRect();
		ghostEl.style.left = `${e.clientX - rect.width / 2}px`;
		ghostEl.style.top = `${e.clientY - rect.height / 2}px`;
	});

	const clientPos = direction === 'horizontal' ? e.clientX : e.clientY;
	dropIndex = getDropIndex(clientPos);
}

function handlePointerUp(_e: PointerEvent) {
	if (!dragId) return;

	const currentIndex = order.indexOf(dragId);
	if (dropIndex !== null && dropIndex !== currentIndex && dropIndex !== currentIndex + 1) {
		const newOrder = order.filter((id) => id !== dragId);
		const insertAt = dropIndex > currentIndex ? dropIndex - 1 : dropIndex;
		newOrder.splice(insertAt, 0, dragId);
		const label = paneMap[dragId]?.label ?? dragId;
		announcement = `${label} moved to position ${insertAt + 1} of ${newOrder.length}`;
		onReorder(newOrder);
	}

	cleanupDrag();
}

function handlePointerCancel() {
	cleanupDrag();
}

function cleanupDrag() {
	if (ghostEl) {
		ghostEl.remove();
		ghostEl = null;
	}
	dragId = null;
	dropIndex = null;
}

function handleKeyDown(e: KeyboardEvent, id: string) {
	const isHorizontal = direction === 'horizontal';
	const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';
	const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';

	if (e.key !== prevKey && e.key !== nextKey) return;
	e.preventDefault();

	const currentIndex = order.indexOf(id);
	let newIndex: number;

	if (e.key === prevKey) {
		newIndex = Math.max(0, currentIndex - 1);
	} else {
		newIndex = Math.min(order.length - 1, currentIndex + 1);
	}

	if (newIndex === currentIndex) return;

	const newOrder = [...order];
	newOrder.splice(currentIndex, 1);
	newOrder.splice(newIndex, 0, id);

	const label = paneMap[id]?.label ?? id;
	announcement = `${label} moved to position ${newIndex + 1} of ${newOrder.length}`;
	onReorder(newOrder);

	tick().then(() => {
		const tab = barEl?.querySelector(`[data-tab-id="${id}"] .grip-handle`) as HTMLElement;
		tab?.focus();
	});
}
</script>

{#if order.length > 1}
	<div
		bind:this={barEl}
		class={cn(tabBarVariants({ direction }), 'tab-bar', className)}
		role="list"
		aria-label="Panel order"
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerCancel}
		onpointerleave={handlePointerCancel}
	>
		{#each order as id, i (id)}
			{@const pane = paneMap[id]}
			{@const isDragged = dragId === id}
			{@const showIndicator = dropIndex !== null && dropIndex === i && dragId !== null && order.indexOf(dragId) !== i && order.indexOf(dragId) !== i - 1}
			<div
				data-tab-id={id}
				class={cn(tabVariants({ active: true }), isDragged && 'dragged-tab')}
				role="listitem"
				aria-label={pane?.label ?? id}
			>
				<button
					class={cn(gripVariants({ direction }), 'grip-handle')}
					aria-label="Drag to reorder {pane?.label ?? id}"
					onpointerdown={(e) => handlePointerDown(e, id)}
					onkeydown={(e) => handleKeyDown(e, id)}
				>
					<span class="i-lucide-grip-vertical w-[14px] h-[14px]"></span>
				</button>
				<span class="tab-label">{pane?.label ?? id}</span>
			</div>
			{#if showIndicator}
				<div class="drop-indicator"></div>
			{/if}
		{/each}
	</div>

	<div class="sr-only" aria-live="polite" aria-atomic="true">
		{announcement}
	</div>
{/if}

<style>
	.tab-bar {
		background: var(--color-surface-1, var(--surface-1));
	}

	.tab-bar [data-tab-id] {
		transition: opacity 100ms ease;
	}

	.tab-bar .dragged-tab {
		opacity: 0.4;
	}

	.tab-bar .grip-handle {
		padding: 2px;
		border: none;
		background: none;
		display: inline-flex;
		align-items: center;
	}

	.tab-bar .grip-handle:hover {
		color: var(--color-fg);
	}

	:global(.tab-ghost) {
		background: var(--color-surface-1, var(--surface-1));
		border: 1px solid var(--color-border);
		border-radius: 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.drop-indicator {
		flex-shrink: 0;
		border-left: 2px solid var(--color-primary);
		border-color: CanvasText;
		border-color: var(--color-primary);
		align-self: stretch;
		min-height: 16px;
	}

	:global([data-direction='vertical']) .drop-indicator,
	.tab-bar.flex-col .drop-indicator {
		border-left: none;
		border-top: 2px solid var(--color-primary);
		border-color: CanvasText;
		border-color: var(--color-primary);
		min-width: 100%;
		min-height: 0;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	@media (pointer: coarse) {
		.tab-bar .grip-handle {
			padding: 8px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tab-bar [data-tab-id] {
			transition: none;
		}
	}
</style>
