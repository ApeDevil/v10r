<script lang="ts">
	/**
	 * User avatar + dropdown menu.
	 * Shows avatar icon in rail mode, full info when expanded.
	 * Dropdown includes profile, settings, theme toggle, and sign out.
	 */

	import Icon from '@iconify/svelte';
	import { cn } from '$lib/utils/cn';
	import { getTheme } from '$lib/stores/theme.svelte';

	interface User {
		name: string;
		email: string;
		avatarUrl?: string;
	}

	interface Props {
		user: User | null;
		forceExpanded?: boolean;
		class?: string;
	}

	let { user, forceExpanded = false, class: className }: Props = $props();

	const theme = getTheme();

	let isDropdownOpen = $state(false);
	let themeSubmenuOpen = $state(false);
	let menuRef: HTMLElement;
	let focusedIndex = $state(-1);
	let menuItems: HTMLElement[] = [];

	function toggleDropdown() {
		isDropdownOpen = !isDropdownOpen;
		if (!isDropdownOpen) {
			themeSubmenuOpen = false;
		}
	}

	function closeDropdown() {
		isDropdownOpen = false;
		themeSubmenuOpen = false;
	}

	function toggleThemeSubmenu(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		themeSubmenuOpen = !themeSubmenuOpen;
	}

	function setTheme(mode: 'light' | 'dark' | 'system') {
		theme.setMode(mode);
		closeDropdown();
	}

	function handleSignOut() {
		// TODO: Implement sign out logic
		console.log('Sign out');
		closeDropdown();
	}

	// Click outside to close
	function handleClickOutside(e: MouseEvent) {
		if (menuRef && !menuRef.contains(e.target as Node)) {
			closeDropdown();
		}
	}

	// Close on Escape and handle arrow key navigation
	function handleKeydown(e: KeyboardEvent) {
		if (!isDropdownOpen) return;

		switch (e.key) {
			case 'Escape':
				closeDropdown();
				break;
			case 'ArrowDown':
				e.preventDefault();
				focusNextItem();
				break;
			case 'ArrowUp':
				e.preventDefault();
				focusPreviousItem();
				break;
			case 'Home':
				e.preventDefault();
				focusFirstItem();
				break;
			case 'End':
				e.preventDefault();
				focusLastItem();
				break;
		}
	}

	function focusNextItem() {
		updateMenuItems();
		if (menuItems.length === 0) return;
		focusedIndex = (focusedIndex + 1) % menuItems.length;
		menuItems[focusedIndex]?.focus();
	}

	function focusPreviousItem() {
		updateMenuItems();
		if (menuItems.length === 0) return;
		focusedIndex = focusedIndex <= 0 ? menuItems.length - 1 : focusedIndex - 1;
		menuItems[focusedIndex]?.focus();
	}

	function focusFirstItem() {
		updateMenuItems();
		if (menuItems.length === 0) return;
		focusedIndex = 0;
		menuItems[0]?.focus();
	}

	function focusLastItem() {
		updateMenuItems();
		if (menuItems.length === 0) return;
		focusedIndex = menuItems.length - 1;
		menuItems[focusedIndex]?.focus();
	}

	function updateMenuItems() {
		menuItems = Array.from(
			menuRef?.querySelectorAll<HTMLElement>('.dropdown-item:not([disabled])') || []
		);
	}

	// Set up click outside listener
	$effect(() => {
		if (isDropdownOpen) {
			document.addEventListener('click', handleClickOutside);
			return () => {
				document.removeEventListener('click', handleClickOutside);
			};
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div bind:this={menuRef} class={cn('relative', className)}>
	{#if user}
		<button
			type="button"
			class={cn(
				'flex items-center gap-3 p-3 w-full bg-transparent border border-border rounded-md text-fg cursor-pointer',
				'transition-all duration-fast hover:bg-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
				'motion-reduce:transition-none',
				isDropdownOpen && 'bg-border'
			)}
			onclick={toggleDropdown}
			aria-label={forceExpanded ? 'User menu' : `User menu for ${user.name}`}
			aria-expanded={isDropdownOpen}
			aria-haspopup="true"
		>
			<div class="w-8 h-8 rounded-full overflow-hidden bg-primary flex items-center justify-center flex-shrink-0">
				{#if user.avatarUrl}
					<img src={user.avatarUrl} alt={user.name} class="w-full h-full object-cover" />
				{:else}
					<span class="text-xl leading-none" aria-label="User avatar">
						<Icon icon="lucide:user" />
					</span>
				{/if}
			</div>

			{#if forceExpanded}
				<div class="user-info">
					<span class="text-sm font-semibold text-fg whitespace-nowrap overflow-hidden text-ellipsis">{user.name}</span>
					<span class="text-xs text-muted whitespace-nowrap overflow-hidden text-ellipsis">{user.email}</span>
				</div>

				<svg
					class={cn(
						'flex-shrink-0 transition-transform duration-fast motion-reduce:transition-none',
						isDropdownOpen && 'rotate-180 motion-reduce:rotate-0'
					)}
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
					<polyline points="18 15 12 9 6 15"></polyline>
				</svg>
			{/if}
		</button>

		{#if isDropdownOpen}
			<div class="user-dropdown" role="menu">
				<a
					href="/profile"
					class="flex items-center gap-3 p-2 px-3 w-full bg-transparent border-none rounded-sm text-fg text-sm no-underline cursor-pointer transition-all duration-fast hover:bg-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 text-left motion-reduce:transition-none"
					role="menuitem"
				>
					<span class="text-lg leading-none flex-shrink-0" aria-hidden="true"><Icon icon="lucide:user" /></span>
					<span class="flex-1">Profile</span>
				</a>

				<a
					href="/settings"
					class="flex items-center gap-3 p-2 px-3 w-full bg-transparent border-none rounded-sm text-fg text-sm no-underline cursor-pointer transition-all duration-fast hover:bg-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 text-left motion-reduce:transition-none"
					role="menuitem"
				>
					<span class="text-lg leading-none flex-shrink-0" aria-hidden="true"><Icon icon="lucide:settings" /></span>
					<span class="flex-1">Settings</span>
				</a>

				<div class="h-px bg-border my-2"></div>

				<button
					type="button"
					class="flex items-center gap-3 p-2 px-3 w-full bg-transparent border-none rounded-sm text-fg text-sm cursor-pointer transition-all duration-fast hover:bg-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 text-left motion-reduce:transition-none"
					onclick={toggleThemeSubmenu}
					aria-expanded={themeSubmenuOpen}
					role="menuitem"
				>
					<span class="text-lg leading-none flex-shrink-0" aria-hidden="true"><Icon icon="lucide:palette" /></span>
					<span class="flex-1">Theme</span>
					<span class={cn('flex items-center flex-shrink-0 transition-transform duration-fast motion-reduce:transition-none', themeSubmenuOpen && 'rotate-90 motion-reduce:rotate-0')}>
						<Icon icon="lucide:chevron-right" />
					</span>
				</button>

				{#if themeSubmenuOpen}
					<div class="pl-2 mt-1">
						<button
							type="button"
							class={cn(
								'flex items-center gap-3 py-1.5 px-3 w-full bg-transparent border-none rounded-sm text-fg text-[0.8125rem] cursor-pointer transition-all duration-fast hover:bg-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 text-left motion-reduce:transition-none',
								theme.mode === 'light' && 'bg-primary text-white'
							)}
							onclick={() => setTheme('light')}
							role="menuitem"
						>
							<span class="text-lg leading-none flex-shrink-0" aria-hidden="true"><Icon icon="lucide:sun" /></span>
							<span class="flex-1">Light</span>
						</button>

						<button
							type="button"
							class={cn(
								'flex items-center gap-3 py-1.5 px-3 w-full bg-transparent border-none rounded-sm text-fg text-[0.8125rem] cursor-pointer transition-all duration-fast hover:bg-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 text-left motion-reduce:transition-none',
								theme.mode === 'dark' && 'bg-primary text-white'
							)}
							onclick={() => setTheme('dark')}
							role="menuitem"
						>
							<span class="text-lg leading-none flex-shrink-0" aria-hidden="true"><Icon icon="lucide:moon" /></span>
							<span class="flex-1">Dark</span>
						</button>

						<button
							type="button"
							class={cn(
								'flex items-center gap-3 py-1.5 px-3 w-full bg-transparent border-none rounded-sm text-fg text-[0.8125rem] cursor-pointer transition-all duration-fast hover:bg-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 text-left motion-reduce:transition-none',
								theme.mode === 'system' && 'bg-primary text-white'
							)}
							onclick={() => setTheme('system')}
							role="menuitem"
						>
							<span class="text-lg leading-none flex-shrink-0" aria-hidden="true"><Icon icon="lucide:monitor" /></span>
							<span class="flex-1">System</span>
						</button>
					</div>
				{/if}

				<div class="h-px bg-border my-2"></div>

				<button
					type="button"
					class="flex items-center gap-3 p-2 px-3 w-full bg-transparent border-none rounded-sm text-error text-sm cursor-pointer transition-all duration-fast hover:bg-error hover:text-white focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 text-left motion-reduce:transition-none"
					onclick={handleSignOut}
					role="menuitem"
				>
					<span class="text-lg leading-none flex-shrink-0" aria-hidden="true"><Icon icon="lucide:log-out" /></span>
					<span class="flex-1">Sign out</span>
				</button>
			</div>
		{/if}
	{:else}
		<a
			href="/auth/signin"
			class="flex items-center gap-3 p-3 w-full bg-primary border-none rounded-md text-white text-sm font-semibold no-underline cursor-pointer transition-bg duration-fast hover:bg-[hsl(from_var(--color-primary)_h_s_calc(l-10))] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 motion-reduce:transition-none"
			aria-label="Sign in"
		>
			<span class="text-xl leading-none" aria-hidden="true"><Icon icon="lucide:key" /></span>
			{#if forceExpanded}
				<span class="sign-in-label">Sign in</span>
			{/if}
		</a>
	{/if}
</div>

<style>
	/* User info fade-in animation */
	.user-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		flex: 1;
		text-align: left;
		min-width: 0;
		opacity: 0;
		animation: fadeIn var(--duration-fast) forwards;
	}

	/* Sign-in label fade-in animation */
	.sign-in-label {
		opacity: 0;
		animation: fadeIn var(--duration-fast) forwards;
	}

	/* Dropdown slide-up animation */
	.user-dropdown {
		position: absolute;
		bottom: calc(100% + var(--spacing-2));
		left: 0;
		right: 0;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
		padding: var(--spacing-2);
		z-index: var(--z-dropdown);
		animation: slideUp var(--duration-fast) ease-out;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes fadeIn {
		to {
			opacity: 1;
		}
	}

	/* Respect reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.user-dropdown {
			animation: none;
		}

		.user-info,
		.sign-in-label {
			animation: none;
			opacity: 1;
		}
	}
</style>
