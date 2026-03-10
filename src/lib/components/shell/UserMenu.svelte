<script lang="ts">
/**
 * User avatar + dropdown menu.
 * Shows avatar icon in rail mode, full info when expanded.
 * Dropdown includes profile, settings, theme toggle, and sign out.
 */

import { DropdownMenu } from 'bits-ui';
import { goto } from '$app/navigation';
import { authClient } from '$lib/auth-client';
import { localizeHref } from '$lib/i18n';
import { getTheme } from '$lib/state/theme.svelte';
import { cn } from '$lib/utils/cn';

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

let themeSubmenuOpen = $state(false);

function setTheme(mode: 'light' | 'dark' | 'system') {
	theme.setMode(mode);
}

async function handleSignOut() {
	await authClient.signOut();
	goto('/');
}
</script>

<div class={cn('relative', className)}>
	{#if user}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class={cn(
					'flex items-center bg-transparent rounded-md text-fg cursor-pointer',
					'transition-all duration-fast hover:bg-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
					'motion-reduce:transition-none data-[state=open]:bg-border',
					forceExpanded
						? 'gap-3 p-3 w-full border border-border'
						: 'h-10 w-10 justify-center border-none'
				)}
				aria-label={forceExpanded ? 'User menu' : `User menu for ${user.name}`}
			>
				<span class="i-lucide-user text-icon-md shrink-0" ></span>

				{#if forceExpanded}
					<div class="user-info">
						<span class="text-sm font-semibold text-fg whitespace-nowrap overflow-hidden text-ellipsis">{user.name}</span>
						<span class="text-xs text-muted whitespace-nowrap overflow-hidden text-ellipsis">{user.email}</span>
					</div>

					<span
						class={cn(
							'i-lucide-chevron-up flex-shrink-0 transition-transform duration-fast motion-reduce:transition-none [.data-\\[state\\=open\\]_&]:rotate-180'
						)}
					/>
				{/if}
			</DropdownMenu.Trigger>

			<DropdownMenu.Portal>
				<DropdownMenu.Content
					class={cn(
						'z-dropdown min-w-[12rem] bg-surface-2 border border-border rounded-md shadow-lg p-2',
						'animate-in slide-in-from-bottom-2 motion-reduce:animate-none'
					)}
					side="top"
					align="start"
					sideOffset={8}
				>
					<DropdownMenu.Item
						class="flex items-center gap-3 p-2 px-3 rounded-sm text-fg text-sm cursor-pointer transition-all duration-fast outline-none data-[highlighted]:bg-border motion-reduce:transition-none"
					>
						{#snippet child({ props })}
							<a {...props} href={localizeHref('/app/account')} class="flex items-center gap-3 no-underline text-fg">
								<span class="i-lucide-user text-lg" ></span>
								<span>Account</span>
							</a>
						{/snippet}
					</DropdownMenu.Item>

					<DropdownMenu.Item
						class="flex items-center gap-3 p-2 px-3 rounded-sm text-fg text-sm cursor-pointer transition-all duration-fast outline-none data-[highlighted]:bg-border motion-reduce:transition-none"
					>
						{#snippet child({ props })}
							<a {...props} href={localizeHref('/app/settings')} class="flex items-center gap-3 no-underline text-fg">
								<span class="i-lucide-settings text-lg" ></span>
								<span>Settings</span>
							</a>
						{/snippet}
					</DropdownMenu.Item>

					<DropdownMenu.Separator class="h-px bg-border" />

					<DropdownMenu.Sub bind:open={themeSubmenuOpen}>
						<DropdownMenu.SubTrigger
							class="flex items-center gap-3 p-2 px-3 rounded-sm text-fg text-sm cursor-pointer transition-all duration-fast outline-none data-[highlighted]:bg-border motion-reduce:transition-none"
						>
							<span class="i-lucide-palette text-lg" ></span>
							<span class="flex-1">Theme</span>
							<span
								class={cn(
									'i-lucide-chevron-right transition-transform duration-fast motion-reduce:transition-none',
									themeSubmenuOpen && 'rotate-90'
								)}
							/>
						</DropdownMenu.SubTrigger>

						<DropdownMenu.SubContent
							class={cn(
								'min-w-[10rem] bg-surface-2 border border-border rounded-md shadow-lg p-2 ml-2',
								'animate-in slide-in-from-left-2 motion-reduce:animate-none'
							)}
							sideOffset={4}
						>
							<DropdownMenu.Item
								class={cn(
									'flex items-center gap-3 py-1.5 px-3 rounded-sm text-fg text-sm cursor-pointer transition-all duration-fast outline-none data-[highlighted]:bg-border motion-reduce:transition-none',
									theme.mode === 'light' && 'bg-primary text-white'
								)}
								onclick={() => setTheme('light')}
							>
								<span class="i-lucide-sun text-lg" ></span>
								<span>Light</span>
							</DropdownMenu.Item>

							<DropdownMenu.Item
								class={cn(
									'flex items-center gap-3 py-1.5 px-3 rounded-sm text-fg text-sm cursor-pointer transition-all duration-fast outline-none data-[highlighted]:bg-border motion-reduce:transition-none',
									theme.mode === 'dark' && 'bg-primary text-white'
								)}
								onclick={() => setTheme('dark')}
							>
								<span class="i-lucide-moon text-lg" ></span>
								<span>Dark</span>
							</DropdownMenu.Item>

							<DropdownMenu.Item
								class={cn(
									'flex items-center gap-3 py-1.5 px-3 rounded-sm text-fg text-sm cursor-pointer transition-all duration-fast outline-none data-[highlighted]:bg-border motion-reduce:transition-none',
									theme.mode === 'system' && 'bg-primary text-white'
								)}
								onclick={() => setTheme('system')}
							>
								<span class="i-lucide-monitor text-lg" ></span>
								<span>System</span>
							</DropdownMenu.Item>
						</DropdownMenu.SubContent>
					</DropdownMenu.Sub>

					<DropdownMenu.Separator class="h-px bg-border" />

					<DropdownMenu.Item
						class="flex items-center gap-3 p-2 px-3 rounded-sm text-error text-sm cursor-pointer transition-all duration-fast outline-none data-[highlighted]:bg-error data-[highlighted]:text-white motion-reduce:transition-none"
						onclick={handleSignOut}
					>
						<span class="i-lucide-log-out text-lg" ></span>
						<span>Sign out</span>
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	{:else}
		<a
			href={localizeHref('/auth/login')}
			class={cn(
				'flex items-center gap-3 p-3 w-full bg-primary rounded-md text-white font-semibold no-underline',
				'transition-colors duration-fast hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
				'motion-reduce:transition-none',
				!forceExpanded && 'justify-center'
			)}
			aria-label="Sign in"
		>
			<span class="i-lucide-key text-xl" ></span>
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

	@keyframes fadeIn {
		to {
			opacity: 1;
		}
	}

	/* Respect reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.user-info,
		.sign-in-label {
			animation: none;
			opacity: 1;
		}
	}
</style>
