<script lang="ts">
	/**
	 * Dropdown submenu for navigation items.
	 * Supports keyboard navigation and click-outside-to-close.
	 */

	import { page } from '$app/state';
	import { cn } from '$lib/utils/cn';

	interface NavDropdownItem {
		href: string;
		label: string;
	}

	interface Props {
		items: NavDropdownItem[];
		open: boolean;
		onClose: () => void;
		class?: string;
	}

	let { items, open, onClose, class: className }: Props = $props();

	let dropdownRef: HTMLElement;
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
					const link = dropdownRef?.querySelector<HTMLAnchorElement>(
						`a[data-index="${focusedIndex}"]`
					);
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
		const link = dropdownRef?.querySelector<HTMLAnchorElement>(`a[data-index="${index}"]`);
		link?.focus();
	}

	// Reset focused index when dropdown opens
	$effect(() => {
		if (open) {
			focusedIndex = -1;
		}
	});

	// Check if item is active
	function isActive(href: string): boolean {
		return page.url.pathname === href;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<nav bind:this={dropdownRef} class={cn('nav-dropdown flex flex-col gap-[0.125rem] py-1 pl-[2.5rem] overflow-hidden origin-top motion-reduce:animate-none', className)} role="menu" aria-label="Submenu">
		{#each items as item, index}
			<a
				href={item.href}
				data-index={index}
				class={cn(
					'block p-2 px-3 text-sm text-muted no-underline rounded-sm transition-all duration-fast whitespace-nowrap hover:bg-border hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 motion-reduce:transition-none',
					isActive(item.href) && 'bg-primary text-white font-semibold'
				)}
				role="menuitem"
				aria-current={isActive(item.href) ? 'page' : undefined}
			>
				{item.label}
			</a>
		{/each}
	</nav>
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

	.nav-dropdown {
		animation: slideDown var(--duration-fast) ease-out;
	}

	@media (prefers-reduced-motion: reduce) {
		.nav-dropdown {
			animation: none;
		}
	}
</style>
