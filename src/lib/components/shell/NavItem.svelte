<script lang="ts">
	/**
	 * Compound navigation button with two click zones:
	 * - Main area: Navigates to page
	 * - Chevron area: Opens dropdown for subpages (if has children)
	 */

	import { page } from '$app/state';
	import NavDropdown from './NavDropdown.svelte';

	interface NavChild {
		href: string;
		label: string;
	}

	interface Props {
		href: string;
		icon: string;
		label: string;
		children?: NavChild[];
		forceExpanded?: boolean;
	}

	let {
		href,
		icon,
		label,
		children = [],
		forceExpanded = false
	}: Props = $props();

	let isDropdownOpen = $state(false);

	// Check if current page matches this nav item or any of its children
	const isActive = $derived(() => {
		if (page.url.pathname === href) return true;
		if (children.length > 0) {
			return children.some((child) => page.url.pathname === child.href);
		}
		return false;
	});

	function toggleDropdown(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		isDropdownOpen = !isDropdownOpen;
	}

	function closeDropdown() {
		isDropdownOpen = false;
	}

	// Close dropdown when navigating
	$effect(() => {
		page.url.pathname;
		isDropdownOpen = false;
	});
</script>

<div class="nav-item-container">
	<a
		{href}
		class="nav-item"
		class:active={isActive()}
		class:has-children={children.length > 0}
		aria-current={isActive() ? 'page' : undefined}
	>
		<span class="nav-icon" aria-hidden="true">{icon}</span>
		{#if forceExpanded}
			<span class="nav-label">{label}</span>
		{/if}

		{#if children.length > 0 && forceExpanded}
			<button
				type="button"
				class="chevron-button"
				class:expanded={isDropdownOpen}
				onclick={toggleDropdown}
				aria-label={isDropdownOpen ? 'Close submenu' : 'Open submenu'}
				aria-expanded={isDropdownOpen}
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<polyline points="9 18 15 12 9 6"></polyline>
				</svg>
			</button>
		{/if}
	</a>

	{#if children.length > 0 && forceExpanded}
		<NavDropdown items={children} open={isDropdownOpen} onClose={closeDropdown} />
	{/if}
</div>

<style>
	.nav-item-container {
		position: relative;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		text-decoration: none;
		color: var(--color-muted);
		border-radius: 0.375rem;
		transition:
			background var(--duration-fast, 150ms),
			color var(--duration-fast, 150ms);
		white-space: nowrap;
		position: relative;
		width: 100%;
	}

	.nav-item:hover {
		background: var(--color-border);
		color: var(--color-fg);
	}

	.nav-item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.nav-item.active {
		background: var(--color-primary);
		color: white;
		font-weight: 600;
	}

	.nav-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
		line-height: 1;
	}

	.nav-label {
		font-size: 0.875rem;
		font-weight: 500;
		flex: 1;
		opacity: 0;
		animation: fadeIn var(--duration-fast, 150ms) forwards;
	}

	.chevron-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		margin-left: auto;
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
		border-radius: 0.25rem;
		transition:
			transform var(--duration-fast, 150ms),
			background var(--duration-fast, 150ms);
	}

	.chevron-button:hover {
		background: rgba(0, 0, 0, 0.1);
	}

	.nav-item.active .chevron-button:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.chevron-button.expanded {
		transform: rotate(90deg);
	}

	@keyframes fadeIn {
		to {
			opacity: 1;
		}
	}

	/* Respect reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.nav-item,
		.chevron-button {
			transition: none;
		}

		.nav-label {
			animation: none;
			opacity: 1;
		}

		.chevron-button.expanded {
			transform: none;
		}
	}
</style>
