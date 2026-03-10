<script lang="ts">
/**
 * Hover-triggered flyout menu for nav items with children.
 * Portals to document.body with fixed positioning.
 * Works in both rail (collapsed) and expanded sidebar modes.
 */

import type { Snippet } from 'svelte';
import { page } from '$app/state';
import { deLocalizeHref, localizeHref } from '$lib/i18n';
import type { NavChild } from '$lib/nav';
import { cn } from '$lib/utils/cn';

interface Props {
	items: NavChild[];
	label: string;
	forceExpanded: boolean;
	children: Snippet;
}

let { items, label, forceExpanded, children }: Props = $props();

let isOpen = $state(false);
let triggerEl = $state<HTMLDivElement>();
let flyoutEl = $state<HTMLDivElement>();
let focusedIndex = $state(-1);
let openTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let top = $state(0);
let left = $state(0);

// Touch device detection via media query
const isTouchDevice = typeof window !== 'undefined' ? window.matchMedia('(hover: none)').matches : false;

function updatePosition() {
	if (!triggerEl) return;
	// display:contents makes the wrapper invisible — use first child for position
	const target = triggerEl.firstElementChild ?? triggerEl;
	const rect = target.getBoundingClientRect();
	left = rect.right + 4;
	top = rect.top;

	// Collision: adjust if flyout would go off bottom
	// Estimate flyout height: header (~36px) + separator (~9px) + items * 36px + padding (8px)
	const headerHeight = forceExpanded ? 0 : 45;
	const estimatedHeight = headerHeight + items.length * 36 + 8;
	const maxTop = window.innerHeight - estimatedHeight - 8;
	if (top > maxTop) {
		top = Math.max(8, maxTop);
	}
}

function scheduleOpen() {
	cancelClose();
	if (isOpen) return;
	openTimer = setTimeout(() => {
		updatePosition();
		isOpen = true;
		focusedIndex = -1;
	}, 150);
}

function cancelOpen() {
	if (openTimer) {
		clearTimeout(openTimer);
		openTimer = null;
	}
}

function scheduleClose() {
	cancelOpen();
	closeTimer = setTimeout(() => {
		isOpen = false;
	}, 150);
}

function cancelClose() {
	if (closeTimer) {
		clearTimeout(closeTimer);
		closeTimer = null;
	}
}

function handleTriggerEnter() {
	if (isTouchDevice) return;
	scheduleOpen();
}

function handleTriggerLeave() {
	if (isTouchDevice) return;
	scheduleClose();
}

function handleFlyoutEnter() {
	cancelClose();
}

function handleFlyoutLeave() {
	scheduleClose();
}

function handleTriggerClick() {
	if (isTouchDevice) {
		if (isOpen) {
			isOpen = false;
		} else {
			updatePosition();
			isOpen = true;
			focusedIndex = -1;
		}
	}
}

function handleTriggerKeydown(e: KeyboardEvent) {
	if (e.key === 'ArrowRight' || (e.key === 'Enter' && !isOpen)) {
		e.preventDefault();
		updatePosition();
		isOpen = true;
		focusedIndex = -1;
	}
}

// Close on route change
$effect(() => {
	page.url.pathname;
	isOpen = false;
});

// Close on Escape and keyboard nav
function handleKeydown(e: KeyboardEvent) {
	if (!isOpen) return;

	switch (e.key) {
		case 'Escape':
			e.preventDefault();
			isOpen = false;
			triggerEl?.querySelector('a')?.focus();
			break;
		case 'ArrowDown':
			e.preventDefault();
			focusedIndex = (focusedIndex + 1) % items.length;
			focusLink(focusedIndex);
			break;
		case 'ArrowUp':
			e.preventDefault();
			focusedIndex = (focusedIndex - 1 + items.length) % items.length;
			focusLink(focusedIndex);
			break;
		case 'Enter':
			if (focusedIndex >= 0 && focusedIndex < items.length) {
				const link = flyoutEl?.querySelector<HTMLAnchorElement>(`a[data-index="${focusedIndex}"]`);
				link?.click();
			}
			break;
	}
}

function focusLink(index: number) {
	const link = flyoutEl?.querySelector<HTMLAnchorElement>(`a[data-index="${index}"]`);
	link?.focus();
}

function isActive(href: string): boolean {
	const path = deLocalizeHref(page.url.pathname);
	return path === href || path.startsWith(`${href}/`);
}

// Close on click outside
function handleDocumentClick(e: MouseEvent) {
	if (!isOpen) return;
	const target = e.target as Node;
	if (triggerEl?.contains(target) || flyoutEl?.contains(target)) return;
	isOpen = false;
}

// Portal action
function portal(node: HTMLElement) {
	document.body.appendChild(node);
	return {
		destroy() {
			node.remove();
		},
	};
}
</script>

<svelte:window onkeydown={handleKeydown} onclick={handleDocumentClick} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={triggerEl}
	class="flyout-trigger"
	onpointerenter={handleTriggerEnter}
	onpointerleave={handleTriggerLeave}
	onclick={handleTriggerClick}
	onkeydown={handleTriggerKeydown}
>
	{@render children()}
</div>

{#if isOpen}
	<div
		bind:this={flyoutEl}
		use:portal
		class="flyout-panel fixed z-dropdown bg-surface-2 border border-border rounded-md shadow-lg py-1"
		style:top="{top}px"
		style:left="{left}px"
		style:min-width="160px"
		onpointerenter={handleFlyoutEnter}
		onpointerleave={handleFlyoutLeave}
		role="menu"
		aria-label="{label} submenu"
	>
		{#if !forceExpanded}
			<div class="px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wide">{label}</div>
			<div class="h-px bg-border mx-2 mb-1"></div>
		{/if}

		{#each items as item, index}
			<a
				href={localizeHref(item.href)}
				data-index={index}
				class={cn(
					'flyout-item block mx-1 px-3 py-2 text-sm text-muted no-underline rounded-sm whitespace-nowrap',
					'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
					isActive(item.href) && 'flyout-item-active bg-primary text-white font-semibold'
				)}
				role="menuitem"
				aria-current={isActive(item.href) ? 'page' : undefined}
			>
				{item.label}
			</a>
		{/each}
	</div>
{/if}

<style>
	.flyout-trigger {
		display: contents;
	}

	/* Instant hover highlight — no transition (per MEMORY.md menu item rule) */
	.flyout-item:not(.flyout-item-active):hover {
		background-color: color-mix(in srgb, var(--color-muted) 15%, transparent);
		color: var(--color-fg);
	}

	/* Subtle entrance animation */
	.flyout-panel {
		animation: flyoutIn var(--duration-fast) ease-out;
	}

	@keyframes flyoutIn {
		from {
			opacity: 0;
			transform: translateX(-4px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.flyout-panel {
			animation: none;
		}
	}
</style>
