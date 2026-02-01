<script lang="ts">
	/**
	 * Compound navigation button with two click zones:
	 * - Main area: Navigates to page
	 * - Chevron area: Opens dropdown for subpages (if has children)
	 */

	import { page } from '$app/state';
	import { cn } from '$lib/utils/cn';
	import { Button } from '$lib/components/primitives/button';
	import NavDropdown from './NavDropdown.svelte';

	interface NavChild {
		href: string;
		label: string;
	}

	interface Props {
		href: string;
		/** CSS icon class (e.g., 'i-lucide-home') */
		icon: string;
		label: string;
		children?: NavChild[];
		forceExpanded?: boolean;
		class?: string;
	}

	let {
		href,
		icon,
		label,
		children = [],
		forceExpanded = false,
		class: className
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

<div class={cn('relative', className)}>
	<div class="flex items-center gap-0 relative">
		<a
			{href}
			class={cn(
				'flex items-center gap-3 p-3 no-underline text-muted rounded-md transition-all duration-fast whitespace-nowrap relative flex-1 hover:bg-border hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 motion-reduce:transition-none',
				isActive() && 'bg-primary text-white font-semibold'
			)}
			aria-current={isActive() ? 'page' : undefined}
			aria-label={forceExpanded ? undefined : label}
		>
			<span class={cn(icon, 'text-[1.5rem] shrink-0 leading-none')} />
			{#if forceExpanded}
				<span class="nav-label text-sm font-medium flex-1 opacity-0 motion-reduce:opacity-100">{label}</span>
			{/if}
		</a>

		{#if children.length > 0 && forceExpanded}
			<button
				type="button"
				class={cn(
					'absolute right-[var(--spacing-3)] flex items-center justify-center w-[24px] h-[24px] p-0 bg-transparent border-none text-muted rounded-sm cursor-pointer',
					'transition-all duration-fast hover:bg-border motion-reduce:transition-none',
					isDropdownOpen && 'rotate-90 motion-reduce:rotate-0'
				)}
				onclick={toggleDropdown}
				aria-label={isDropdownOpen ? 'Close submenu' : 'Open submenu'}
				aria-expanded={isDropdownOpen}
			>
				<span class="i-lucide-chevron-right text-[16px]" />
			</button>
		{/if}
	</div>

	{#if children.length > 0 && forceExpanded}
		<NavDropdown items={children} open={isDropdownOpen} onClose={closeDropdown} />
	{/if}
</div>

<style>
	/* Custom fadeIn animation */
	@keyframes fadeIn {
		to {
			opacity: 1;
		}
	}

	.nav-label {
		animation: fadeIn var(--duration-fast) forwards;
	}

	@media (prefers-reduced-motion: reduce) {
		.nav-label {
			animation: none;
			opacity: 1;
		}
	}

	/* Active state color override for chevron button - CSS variable approach for specificity */
	button:has(~ a[aria-current="page"]) {
		color: white;
	}

	button:hover:has(~ a[aria-current="page"]) {
		background: rgba(255, 255, 255, 0.2);
	}
</style>
