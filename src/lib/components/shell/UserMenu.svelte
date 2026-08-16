<script lang="ts">
/**
 * User avatar + dropdown menu.
 * Shows avatar icon in rail mode, full info when expanded.
 * Dropdown includes account, theme picker, language picker, and sign out.
 * Account is the single door to the personal area (/account: dashboard,
 * settings, notifications, security) — no sidebar nav entry duplicates it.
 *
 * Two variants, set by the mounting context (both instances are always mounted;
 * CSS decides which shell is visible, so the prop — not a MediaQuery — discriminates):
 * - 'rail' (desktop sidebar): anchored menu; Theme/Language open side-anchored submenus.
 * - 'drawer' (mobile drawer): the menu is a static surface pinned to the bottom-LEFT
 *   screen edge (clear of the right-anchored drawer); Theme/Language open a second
 *   static panel stacked on top of it, one elevation rung up.
 */

import { DropdownMenu } from 'bits-ui';
import { goto, invalidateAll } from '$app/navigation';
import { page } from '$app/state';
import { ConfirmDialog } from '$lib/components/composites';
import { locales, localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { signOutAndFlush } from '$lib/pwa/sign-out';
import { getLayerScope, layerStack, setLayerScope } from '$lib/state/layer-stack.svelte';
import { getTheme } from '$lib/state/theme.svelte';
import { elevationAttr, getParentLevel } from '$lib/styles/elevation';
import { floatingContentBase } from '$lib/styles/floating';
import { cn } from '$lib/utils/cn';

interface User {
	name: string;
	email: string;
	avatarUrl?: string;
}

interface Props {
	user: User | null;
	variant: 'drawer' | 'rail';
	forceExpanded?: boolean;
	class?: string;
}

let { user, variant, forceExpanded = false, class: className }: Props = $props();

const theme = getTheme();

// Relative elevation: the menu sits one rung above its mounting plane, the stacked panel one
// above the menu — resolved from context, never hardcoded. Rail (sidebar E1) → menu E2 → panel
// E3; the mobile drawer plane → menu → panel. This also fixes the old rail submenu level-skip
// (menu E2 jumped straight to submenu E4; now it is a clean E2 → E3).
const menuLevel = getParentLevel() + 1;
const panelLevel = menuLevel + 1;

let menuOpen = $state(false);
let signOutConfirmOpen = $state(false);

/* Theme/Language submenu open state — drives chevron rotation; in the drawer
 * variant the stacked panel's back row closes through these binds. */
let themeSubmenuOpen = $state(false);
let languageSubmenuOpen = $state(false);

/* Layer identity. `ownerScope` is whatever encloses this menu (the mobile drawer, or
 * nothing on the rail) — carried on every push so an enclosing layer that yields to
 * covering surfaces recognises these as its own and stays open. `menuScope` extends it
 * for what the menu itself opens: the stacked panel here, the sign-out ConfirmDialog
 * below through context. Both read at init — getContext cannot run inside $effect. */
const menuLayerId = `user-menu-${variant}`;
const ownerScope = getLayerScope();
const menuScope = setLayerScope(menuLayerId);

/* Register as a layer while open so hand-rolled Escape/overlay handlers underneath
 * (the mobile drawer) peel one layer per keypress instead of closing with us. */
$effect(() => {
	if (menuOpen) {
		layerStack.push(menuLayerId, ownerScope);
		return () => layerStack.pop(menuLayerId);
	}
});

/* The stacked Theme/Language panel is its own dismissal layer (drawer variant only):
 * Escape peels panel → menu → drawer, one keypress each. */
$effect(() => {
	if (variant === 'drawer' && (themeSubmenuOpen || languageSubmenuOpen)) {
		layerStack.push('user-menu-panel', menuScope);
		return () => layerStack.pop('user-menu-panel');
	}
});

const currentLocale = $derived(page.data.locale ?? 'en');
const currentHref = $derived(page.url.pathname + page.url.search + page.url.hash);

function localeLabel(locale: string): string {
	switch (locale) {
		case 'en':
			return m.shell_language_en();
		case 'de':
			return m.shell_language_de();
		case 'ru':
			return m.shell_language_ru();
		default:
			return locale;
	}
}

const THEME_OPTIONS = [
	{ value: 'light', icon: 'i-lucide-sun', label: () => m.shell_theme_light() },
	{ value: 'dark', icon: 'i-lucide-moon', label: () => m.shell_theme_dark() },
	{ value: 'system', icon: 'i-lucide-monitor', label: () => m.shell_theme_system() },
] as const;

const themeModeLabel = $derived(THEME_OPTIONS.find((o) => o.value === theme.mode)?.label() ?? m.shell_theme_system());

function setTheme(mode: string) {
	if (mode === 'light' || mode === 'dark' || mode === 'system') {
		theme.setMode(mode);
	}
}

async function handleSignOut() {
	// Also flushes stale service-worker caches (PWA hygiene on shared devices).
	await signOutAndFlush();
	// Refresh the shared root-layout `session` (reused across the client-side
	// nav) so the shell drops back to the logged-out state without a reload.
	await invalidateAll();
	goto(localizeHref('/'));
}

/* cn() is clsx-only (no merge): a destructive item must get its own conflict-free
 * string — stacking a second data-[highlighted]:bg-* on itemClass leaves the winner
 * to CSS source order. */
const itemBase = 'flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-sm text-sm cursor-pointer outline-none';
const itemClass = `${itemBase} text-fg data-[highlighted]:bg-fg-alpha`;
const destructiveItemClass = `${itemBase} text-error data-[highlighted]:bg-error-light`;

/* Drawer variant: ContentStatic/SubContentStatic — no Floating UI, position is plain
 * fixed CSS (the Portal target is body, so `fixed` is viewport-true). Menu and panel
 * share one surface geometry; the panel staggers 8px right / 12px up so the covered
 * menu reads as a card edge underneath. Appearance strata follow the elevation ladder:
 * drawer E1 → menu E2 → panel E3 (a coverer sits one rung above what it covers).
 *
 * The 6rem bottom offset MUST clear the drawer's footer trigger row: the trigger
 * opens on pointerdown (mouse), and a menu rendered under the still-pressed pointer
 * receives the release as a selection — Bits items synthesize click() on pointerup
 * when the press started outside them (press-drag-release), which insta-selected
 * Sign out when the menu was pinned at the very bottom. */
const drawerSurfaceClass = cn(
	floatingContentBase(),
	'fixed z-dropdown w-[min(18rem,calc(100vw-1.5rem))] p-2 max-h-[calc(100dvh-8rem-var(--safe-bottom))]',
	'animate-in slide-in-from-bottom-2 motion-reduce:animate-none',
);
const drawerMenuStyle = 'left: calc(0.5rem + env(safe-area-inset-left, 0px)); bottom: calc(6rem + var(--safe-bottom));';
const drawerPanelStyle =
	'left: calc(1rem + env(safe-area-inset-left, 0px)); bottom: calc(6.75rem + var(--safe-bottom));';

/* Same family of hazard for the stacked panel: it is pinned OVER the menu, so Bits'
 * default hover-open (openDelay 0) would materialize it under an in-flight mouse
 * click — the panel must open on click/tap/keyboard only. preventDefault cancels the
 * internal pointermove handler (user handlers run first in Bits' mergeProps chain). */
const subTriggerHoverGuard = variant === 'drawer' ? (e: PointerEvent) => e.preventDefault() : undefined;
</script>

<div class={cn('relative', className)}>
	{#if user}
		{#snippet themeOptions()}
			<DropdownMenu.RadioGroup value={theme.mode} onValueChange={setTheme}>
				{#each THEME_OPTIONS as option (option.value)}
					<DropdownMenu.RadioItem value={option.value} class={itemClass}>
						{#snippet children({ checked })}
							<span class={cn(option.icon, 'text-lg')}></span>
							<span class="flex-1">{option.label()}</span>
							{#if checked}<span class="i-lucide-check text-base text-primary"></span>{/if}
						{/snippet}
					</DropdownMenu.RadioItem>
				{/each}
			</DropdownMenu.RadioGroup>
		{/snippet}

		{#snippet languageOptions()}
			{#each locales as locale}
				{@const isActive = locale === currentLocale}
				<DropdownMenu.Item>
					{#snippet child({ props })}
						<a
							{...props}
							href={localizeHref(currentHref, { locale })}
							lang={locale}
							aria-current={isActive ? 'true' : undefined}
							data-sveltekit-reload
							class={cn(itemClass, 'no-underline')}
						>
							<span class="flex-1">{localeLabel(locale)}</span>
							{#if isActive}<span class="i-lucide-check text-base text-primary"></span>{/if}
						</a>
					{/snippet}
				</DropdownMenu.Item>
			{/each}
		{/snippet}

		{#snippet menuItems()}
			<DropdownMenu.Item>
				{#snippet child({ props })}
					<a {...props} href={localizeHref('/account')} class={cn(itemClass, 'no-underline')}>
						<span class="i-lucide-user text-lg" ></span>
						<span>{m.shell_account()}</span>
					</a>
				{/snippet}
			</DropdownMenu.Item>

			<DropdownMenu.Separator class="h-px bg-border" />

			<DropdownMenu.Sub bind:open={themeSubmenuOpen}>
				<DropdownMenu.SubTrigger
					class={cn(itemClass, 'data-[state=open]:bg-fg-alpha')}
					onpointermove={subTriggerHoverGuard}
				>
					<span class="i-lucide-palette text-lg" ></span>
					<span class="flex-1">{m.shell_theme()}</span>
					<span class="text-xs text-muted">{themeModeLabel}</span>
					<span
						class={cn(
							'i-lucide-chevron-right transition-transform duration-fast motion-reduce:transition-none',
							themeSubmenuOpen && 'rotate-90'
						)}
					></span>
				</DropdownMenu.SubTrigger>

				{#if variant === 'drawer'}
					<!-- Stacked panel: Escape peels only this layer ("close" stops the
					     defer chain), back row does the same for touch. -->
					<DropdownMenu.SubContentStatic
						data-elevation={elevationAttr(panelLevel)}
						escapeKeydownBehavior="close"
						class={drawerSurfaceClass}
						style={drawerPanelStyle}
					>
						<DropdownMenu.Item
							closeOnSelect={false}
							onSelect={() => (themeSubmenuOpen = false)}
							class={itemClass}
						>
							<span class="i-lucide-chevron-left text-lg" ></span>
							<span class="flex-1 font-semibold">{m.shell_theme()}</span>
						</DropdownMenu.Item>
						<DropdownMenu.Separator class="h-px bg-border" />
						{@render themeOptions()}
					</DropdownMenu.SubContentStatic>
				{:else}
					<DropdownMenu.SubContent
						data-elevation={elevationAttr(panelLevel)}
						class={cn(
							'z-dropdown min-w-[10rem] max-w-[calc(100vw-1rem)] border rounded-md p-2',
							'animate-in slide-in-from-left-2 motion-reduce:animate-none'
						)}
						sideOffset={8}
						collisionPadding={8}
					>
						{@render themeOptions()}
					</DropdownMenu.SubContent>
				{/if}
			</DropdownMenu.Sub>

			<DropdownMenu.Sub bind:open={languageSubmenuOpen}>
				<DropdownMenu.SubTrigger
					class={cn(itemClass, 'data-[state=open]:bg-fg-alpha')}
					onpointermove={subTriggerHoverGuard}
				>
					<span class="i-lucide-languages text-lg" ></span>
					<span class="flex-1">{m.shell_language()}</span>
					<span class="text-xs text-muted">{localeLabel(currentLocale)}</span>
					<span
						class={cn(
							'i-lucide-chevron-right transition-transform duration-fast motion-reduce:transition-none',
							languageSubmenuOpen && 'rotate-90'
						)}
					></span>
				</DropdownMenu.SubTrigger>

				{#if variant === 'drawer'}
					<DropdownMenu.SubContentStatic
						data-elevation={elevationAttr(panelLevel)}
						escapeKeydownBehavior="close"
						class={drawerSurfaceClass}
						style={drawerPanelStyle}
					>
						<DropdownMenu.Item
							closeOnSelect={false}
							onSelect={() => (languageSubmenuOpen = false)}
							class={itemClass}
						>
							<span class="i-lucide-chevron-left text-lg" ></span>
							<span class="flex-1 font-semibold">{m.shell_language()}</span>
						</DropdownMenu.Item>
						<DropdownMenu.Separator class="h-px bg-border" />
						{@render languageOptions()}
					</DropdownMenu.SubContentStatic>
				{:else}
					<DropdownMenu.SubContent
						data-elevation={elevationAttr(panelLevel)}
						class={cn(
							'z-dropdown min-w-[10rem] max-w-[calc(100vw-1rem)] border rounded-md p-2',
							'animate-in slide-in-from-left-2 motion-reduce:animate-none'
						)}
						sideOffset={8}
						collisionPadding={8}
					>
						{@render languageOptions()}
					</DropdownMenu.SubContent>
				{/if}
			</DropdownMenu.Sub>

			<DropdownMenu.Separator class="h-px bg-border" />

			<DropdownMenu.Item
				class={destructiveItemClass}
				onSelect={() => (signOutConfirmOpen = true)}
			>
				<span class="i-lucide-log-out text-lg" ></span>
				<span>{m.shell_sign_out()}</span>
			</DropdownMenu.Item>
		{/snippet}

		<DropdownMenu.Root bind:open={menuOpen}>
			<DropdownMenu.Trigger
				style="min-height: var(--sidebar-item-size)"
				class={cn(
					'flex items-center bg-transparent rounded-md text-fg cursor-pointer',
					'transition-all duration-fast hover:bg-fg-alpha focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
					'motion-reduce:transition-none data-[state=open]:bg-fg-alpha',
					forceExpanded
						? 'gap-3 p-3 w-full border border-border'
						: 'justify-center border-none rail-item'
				)}
				aria-label={forceExpanded ? m.shell_user_menu() : m.shell_user_menu_for({ name: user.name })}
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
					></span>
				{/if}
			</DropdownMenu.Trigger>

			<DropdownMenu.Portal>
				{#if variant === 'drawer'}
					<DropdownMenu.ContentStatic
					data-elevation={elevationAttr(menuLevel)}
					class={drawerSurfaceClass}
					style={drawerMenuStyle}
				>
						{@render menuItems()}
					</DropdownMenu.ContentStatic>
				{:else}
					<DropdownMenu.Content
						data-elevation={elevationAttr(menuLevel)}
						class={cn(
							'z-dropdown min-w-[12rem] max-w-[min(18rem,calc(100vw-1rem))] border rounded-md p-2',
							'max-h-[var(--bits-dropdown-menu-content-available-height,80vh)] overflow-y-auto',
							'animate-in slide-in-from-bottom-2 motion-reduce:animate-none'
						)}
						side="top"
						align="start"
						sideOffset={8}
						collisionPadding={8}
					>
						{@render menuItems()}
					</DropdownMenu.Content>
				{/if}
			</DropdownMenu.Portal>
		</DropdownMenu.Root>

		<ConfirmDialog
			bind:open={signOutConfirmOpen}
			title={m.shell_sign_out_confirm_title()}
			description={m.shell_sign_out_confirm_body()}
			confirmLabel={m.shell_sign_out()}
			destructive
			onconfirm={() => {
				signOutConfirmOpen = false;
				void handleSignOut();
			}}
			oncancel={() => (signOutConfirmOpen = false)}
		/>
	{:else}
		<a
			href={localizeHref('/auth/login')}
			class={cn(
				'flex items-center gap-3 p-3 w-full bg-primary rounded-md text-white font-semibold no-underline',
				'transition-colors duration-fast hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
				'motion-reduce:transition-none',
				!forceExpanded && 'justify-center'
			)}
			aria-label={m.nav_log_in()}
		>
			<span class="i-lucide-key text-xl" ></span>
			{#if forceExpanded}
				<span class="sign-in-label">{m.nav_log_in()}</span>
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
