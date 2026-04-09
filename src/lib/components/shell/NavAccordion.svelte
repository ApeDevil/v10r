<script lang="ts">
/**
 * Inline accordion submenu for navigation items (mobile drawer).
 * Supports keyboard navigation and click-outside-to-close.
 */

import { page } from '$app/state';
import { deLocalizeHref, localizeHref } from '$lib/i18n';
import type { NavChild } from '$lib/nav';
import { cn } from '$lib/utils/cn';
import NavLink from './NavLink.svelte';

interface Props {
	items: NavChild[];
	open: boolean;
	onClose: () => void;
	class?: string;
}

let { items, open, onClose, class: className }: Props = $props();

let accordionRef: HTMLElement | undefined = $state();
let focusedIndex = $state(-1);

// Handle keyboard navigation
function handleKeydown(e: KeyboardEvent) {
	if (!open) return;

	switch (e.key) {
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
				const link = accordionRef?.querySelector<HTMLAnchorElement>(`a[data-index="${focusedIndex}"]`);
				link?.click();
			}
			break;
		case 'Escape':
			e.preventDefault();
			onClose();
			break;
	}
}

function focusLink(index: number) {
	const link = accordionRef?.querySelector<HTMLAnchorElement>(`a[data-index="${index}"]`);
	link?.focus();
}

// Reset focused index when accordion opens
$effect(() => {
	if (open) {
		focusedIndex = -1;
	}
});

// Check if item is active (exact match or nested route)
function isActive(href: string): boolean {
	const path = deLocalizeHref(page.url.pathname);
	return path === href || path.startsWith(`${href}/`);
}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div bind:this={accordionRef} class={cn('nav-accordion flex flex-col gap-[0.125rem] py-1 pl-[2.5rem] overflow-hidden origin-top motion-reduce:animate-none', className)} role="menu" aria-label="Submenu">
		{#each items as item, index}
			<NavLink
				href={localizeHref(item.href)}
				active={isActive(item.href)}
				data-index={index}
				class="block p-2 px-3 text-sm text-muted no-underline rounded-sm transition-all duration-fast whitespace-nowrap hover:bg-fg-alpha hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 motion-reduce:transition-none"
				role="menuitem"
			>
				{item.label}
			</NavLink>
		{/each}
	</div>
{/if}

<style>
	/* Custom slideDown animation */
	@keyframes slideDown {
		from {
			opacity: 0;
			max-height: 0;
		}
		to {
			opacity: 1;
			max-height: 500px;
		}
	}

	.nav-accordion {
		animation: slideDown var(--duration-fast) ease-out;
	}

	@media (prefers-reduced-motion: reduce) {
		.nav-accordion {
			animation: none;
		}
	}
</style>
