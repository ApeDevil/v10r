<script lang="ts">
	/**
	 * User avatar + dropdown menu.
	 * Shows avatar icon in rail mode, full info when expanded.
	 * Dropdown includes profile, settings, theme toggle, and sign out.
	 */

	import { getTheme } from '$lib/stores/theme.svelte';

	interface User {
		name: string;
		email: string;
		avatarUrl?: string;
	}

	interface Props {
		user: User | null;
		forceExpanded?: boolean;
	}

	let { user, forceExpanded = false }: Props = $props();

	const theme = getTheme();

	let isDropdownOpen = $state(false);
	let themeSubmenuOpen = $state(false);
	let menuRef: HTMLElement;

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

	// Close on Escape
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && isDropdownOpen) {
			closeDropdown();
		}
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

<div bind:this={menuRef} class="user-menu" class:expanded={forceExpanded}>
	{#if user}
		<button
			type="button"
			class="user-trigger"
			class:dropdown-open={isDropdownOpen}
			onclick={toggleDropdown}
			aria-label={forceExpanded ? 'User menu' : `User menu for ${user.name}`}
			aria-expanded={isDropdownOpen}
			aria-haspopup="true"
		>
			<div class="user-avatar">
				{#if user.avatarUrl}
					<img src={user.avatarUrl} alt={user.name} />
				{:else}
					<span class="avatar-icon">👤</span>
				{/if}
			</div>

			{#if forceExpanded}
				<div class="user-info">
					<span class="user-name">{user.name}</span>
					<span class="user-email">{user.email}</span>
				</div>

				<svg
					class="chevron"
					class:rotated={isDropdownOpen}
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
				<a href="/profile" class="dropdown-item" role="menuitem">
					<span class="item-icon">👤</span>
					<span class="item-label">Profile</span>
				</a>

				<a href="/settings" class="dropdown-item" role="menuitem">
					<span class="item-icon">⚙️</span>
					<span class="item-label">Settings</span>
				</a>

				<div class="dropdown-divider"></div>

				<button
					type="button"
					class="dropdown-item theme-toggle"
					onclick={toggleThemeSubmenu}
					aria-expanded={themeSubmenuOpen}
					role="menuitem"
				>
					<span class="item-icon">🎨</span>
					<span class="item-label">Theme</span>
					<svg
						class="submenu-chevron"
						class:rotated={themeSubmenuOpen}
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

				{#if themeSubmenuOpen}
					<div class="theme-submenu">
						<button
							type="button"
							class="dropdown-item submenu-item"
							class:active={theme.mode === 'light'}
							onclick={() => setTheme('light')}
							role="menuitem"
						>
							<span class="item-icon">☀️</span>
							<span class="item-label">Light</span>
						</button>

						<button
							type="button"
							class="dropdown-item submenu-item"
							class:active={theme.mode === 'dark'}
							onclick={() => setTheme('dark')}
							role="menuitem"
						>
							<span class="item-icon">🌙</span>
							<span class="item-label">Dark</span>
						</button>

						<button
							type="button"
							class="dropdown-item submenu-item"
							class:active={theme.mode === 'system'}
							onclick={() => setTheme('system')}
							role="menuitem"
						>
							<span class="item-icon">💻</span>
							<span class="item-label">System</span>
						</button>
					</div>
				{/if}

				<div class="dropdown-divider"></div>

				<button type="button" class="dropdown-item sign-out" onclick={handleSignOut} role="menuitem">
					<span class="item-icon">🚪</span>
					<span class="item-label">Sign out</span>
				</button>
			</div>
		{/if}
	{:else}
		<a href="/auth/signin" class="sign-in-button">
			<span class="sign-in-icon">🔑</span>
			{#if forceExpanded}
				<span class="sign-in-label">Sign in</span>
			{/if}
		</a>
	{/if}
</div>

<style>
	.user-menu {
		position: relative;
	}

	.user-trigger {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		width: 100%;
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: 0.375rem;
		color: var(--color-fg);
		cursor: pointer;
		transition:
			background var(--duration-fast, 150ms),
			border-color var(--duration-fast, 150ms);
	}

	.user-trigger:hover {
		background: var(--color-border);
	}

	.user-trigger:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.user-trigger.dropdown-open {
		background: var(--color-border);
	}

	.user-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		overflow: hidden;
		background: var(--color-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.user-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-icon {
		font-size: 1.25rem;
		line-height: 1;
	}

	.user-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		flex: 1;
		text-align: left;
		min-width: 0;
		opacity: 0;
		animation: fadeIn var(--duration-fast, 150ms) forwards;
	}

	.user-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-fg);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.user-email {
		font-size: 0.75rem;
		color: var(--color-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chevron {
		flex-shrink: 0;
		transition: transform var(--duration-fast, 150ms);
	}

	.chevron.rotated {
		transform: rotate(180deg);
	}

	.user-dropdown {
		position: absolute;
		bottom: calc(100% + 0.5rem);
		left: 0;
		right: 0;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 0.375rem;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
		padding: 0.5rem;
		z-index: 100;
		animation: slideUp var(--duration-fast, 150ms) ease-out;
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

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		width: 100%;
		background: transparent;
		border: none;
		border-radius: 0.25rem;
		color: var(--color-fg);
		font-size: 0.875rem;
		text-decoration: none;
		cursor: pointer;
		transition:
			background var(--duration-fast, 150ms),
			color var(--duration-fast, 150ms);
		text-align: left;
	}

	.dropdown-item:hover {
		background: var(--color-border);
	}

	.dropdown-item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.dropdown-item.active {
		background: var(--color-primary);
		color: white;
	}

	.item-icon {
		font-size: 1.125rem;
		line-height: 1;
		flex-shrink: 0;
	}

	.item-label {
		flex: 1;
	}

	.submenu-chevron {
		flex-shrink: 0;
		transition: transform var(--duration-fast, 150ms);
	}

	.submenu-chevron.rotated {
		transform: rotate(90deg);
	}

	.theme-submenu {
		padding-left: 0.5rem;
		margin-top: 0.25rem;
	}

	.submenu-item {
		font-size: 0.8125rem;
		padding: 0.375rem 0.75rem;
	}

	.dropdown-divider {
		height: 1px;
		background: var(--color-border);
		margin: 0.5rem 0;
	}

	.sign-out {
		color: var(--color-error);
	}

	.sign-out:hover {
		background: var(--color-error);
		color: white;
	}

	.sign-in-button {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		width: 100%;
		background: var(--color-primary);
		border: none;
		border-radius: 0.375rem;
		color: white;
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
		transition: background var(--duration-fast, 150ms);
	}

	.sign-in-button:hover {
		background: var(--color-primary-dark, hsl(from var(--color-primary) h s calc(l - 10)));
	}

	.sign-in-button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.sign-in-icon {
		font-size: 1.25rem;
		line-height: 1;
	}

	.sign-in-label {
		opacity: 0;
		animation: fadeIn var(--duration-fast, 150ms) forwards;
	}

	/* Respect reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.user-trigger,
		.dropdown-item,
		.chevron,
		.submenu-chevron {
			transition: none;
		}

		.user-dropdown {
			animation: none;
		}

		.user-info,
		.sign-in-label {
			animation: none;
			opacity: 1;
		}

		.chevron.rotated,
		.submenu-chevron.rotated {
			transform: none;
		}
	}
</style>
