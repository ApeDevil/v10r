<script lang="ts">
	/**
	 * Dropdown submenu for navigation items.
	 * Supports keyboard navigation and click-outside-to-close.
	 */

	import { page } from '$app/state';

	interface NavDropdownItem {
		href: string;
		label: string;
	}

	interface Props {
		items: NavDropdownItem[];
		open: boolean;
		onClose: () => void;
	}

	let { items, open, onClose }: Props = $props();

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
	<nav bind:this={dropdownRef} class="nav-dropdown" role="menu" aria-label="Submenu">
		{#each items as item, index}
			<a
				href={item.href}
				data-index={index}
				class="dropdown-item"
				class:active={isActive(item.href)}
				role="menuitem"
				aria-current={isActive(item.href) ? 'page' : undefined}
			>
				{item.label}
			</a>
		{/each}
	</nav>
{/if}

<style>
	.nav-dropdown {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: 0.25rem 0 0.25rem 2.5rem;
		overflow: hidden;
		animation: slideDown var(--duration-fast, 150ms) ease-out;
		transform-origin: top;
	}

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

	.dropdown-item {
		display: block;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		color: var(--color-muted);
		text-decoration: none;
		border-radius: 0.25rem;
		transition:
			background var(--duration-fast, 150ms),
			color var(--duration-fast, 150ms);
		white-space: nowrap;
	}

	.dropdown-item:hover {
		background: var(--color-border);
		color: var(--color-fg);
	}

	.dropdown-item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.dropdown-item.active {
		background: var(--color-primary);
		color: white;
		font-weight: 600;
	}

	/* Respect reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.nav-dropdown {
			animation: none;
		}

		.dropdown-item {
			transition: none;
		}
	}
</style>
