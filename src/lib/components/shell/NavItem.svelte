<script lang="ts">
	/**
	 * Navigation item with two modes:
	 * - Flyout (default): Hover opens a portal flyout for children
	 * - Dropdown (mobile): Click chevron opens inline dropdown
	 */

	import { page } from '$app/state';
	import { cn } from '$lib/utils/cn';
	import { localizeHref, deLocalizeHref } from '$lib/i18n';
	import { Tooltip } from '$lib/components/primitives/tooltip';
	import NavAccordion from './NavAccordion.svelte';
	import NavFlyout from './NavFlyout.svelte';
	import type { NavChild } from '$lib/nav';

	interface Props {
		href: string;
		/** CSS icon class (e.g., 'i-lucide-home') */
		icon: string;
		label: string;
		children?: NavChild[];
		forceExpanded?: boolean;
		useFlyout?: boolean;
		class?: string;
	}

	let {
		href,
		icon,
		label,
		children = [],
		forceExpanded = false,
		useFlyout = true,
		class: className
	}: Props = $props();

	let isDropdownOpen = $state(false);

	// Check if current page matches this nav item or any of its children (including nested routes)
	const isActive = $derived.by(() => {
		const path = deLocalizeHref(page.url.pathname);
		if (path === href) return true;
		if (children.length > 0) {
			return children.some(
				(child) => path === child.href || path.startsWith(child.href + '/'),
			);
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

	const hasFlyoutChildren = $derived(children.length > 0 && useFlyout);
	const hasDropdownChildren = $derived(children.length > 0 && !useFlyout);
</script>

{#snippet navLink()}
	<a
		href={localizeHref(href)}
		class={cn(
			'flex items-center no-underline text-muted rounded-md transition-all duration-fast whitespace-nowrap relative hover:bg-border hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 motion-reduce:transition-none',
			forceExpanded
				? 'h-10 gap-3 px-2 flex-1'
				: 'h-10 w-10 justify-center',
			isActive && 'bg-primary text-white font-semibold'
		)}
		aria-current={isActive ? 'page' : undefined}
		aria-label={forceExpanded ? undefined : label}
	>
		<span class={cn(icon, 'text-icon-md shrink-0 leading-none')} />
		{#if forceExpanded}
			<span class="nav-label text-sm font-medium flex-1 opacity-0 motion-reduce:opacity-100">{label}</span>
		{/if}
	</a>
{/snippet}

<div class={cn('relative', className)}>
	{#if hasFlyoutChildren}
		<!-- Flyout mode: hover opens portal flyout -->
		<NavFlyout items={children} {label} {forceExpanded}>
			<div class="flex items-center gap-0 relative">
				{@render navLink()}
			</div>
		</NavFlyout>
	{:else}
		<!-- No flyout: tooltip for rail, plain link for expanded -->
		<div class="flex items-center gap-0 relative">
			{#if forceExpanded}
				{@render navLink()}
			{:else}
				<Tooltip content={label} side="right" delayDuration={300}>
					{@render navLink()}
				</Tooltip>
			{/if}

			{#if hasDropdownChildren && forceExpanded}
				<button
					type="button"
					class={cn(
						'absolute right-0 flex items-center justify-center w-10 h-10 p-0 bg-transparent border-none rounded-md cursor-pointer',
						'transition-all duration-fast motion-reduce:transition-none',
						isDropdownOpen && 'rotate-90 motion-reduce:rotate-0',
						isActive ? 'text-white hover:bg-white/20' : 'text-muted hover:bg-border'
					)}
					onclick={toggleDropdown}
					aria-label={isDropdownOpen ? 'Close submenu' : 'Open submenu'}
					aria-expanded={isDropdownOpen}
				>
					<span class="i-lucide-chevron-right text-icon-sm" />
				</button>
			{/if}
		</div>

		{#if hasDropdownChildren && forceExpanded}
			<NavAccordion items={children} open={isDropdownOpen} onClose={closeDropdown} />
		{/if}
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
</style>
