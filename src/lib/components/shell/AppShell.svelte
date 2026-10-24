<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import type { CommandPaletteItem } from '#lib/components/composites/command-palette/index.ts';
import { ToastContainer } from '#lib/components/composites/toast/index.ts';
import { DESK_PANELS } from '#lib/desk/panels.ts';
import type { Locale } from '#lib/i18n/index.ts';
import { localizeHref } from '#lib/i18n/runtime.ts';
import * as m from '#lib/paraglide/messages.js';
import type { SearchResult } from '#lib/search/types.ts';
import type { ResolvedAnnouncement } from '#lib/server/admin/announcements.ts';
import { chatbotSession } from '#lib/state/chatbot-session.svelte.ts';
import { getModals } from '#lib/state/modals.svelte.ts';
import { createSearchEngine } from '#lib/state/search.svelte.ts';
import { type Session, setSessionContext } from '#lib/state/session.svelte.ts';
import { getSidebar } from '#lib/state/sidebar.svelte.ts';
import { getTheme } from '#lib/state/theme.svelte.ts';
import { cn } from '#lib/utils/cn.ts';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import AnnouncementBanner from './AnnouncementBanner.svelte';
import ConsentBanner from './ConsentBanner.svelte';
import Footer from './Footer.svelte';
import NavigationProgress from './NavigationProgress.svelte';
import ShortcutsDialog from './ShortcutsDialog.svelte';
import Sidebar from './Sidebar.svelte';
import SessionMonitor from './session/SessionMonitor.svelte';

type Props = {
	children?: import('svelte').Snippet;
	session?: Session;
	/** Whether the current user has admin privileges. */
	isAdmin?: boolean;
	/** Immersive mode: hides the footer for full-viewport layouts like the desk. */
	immersive?: boolean;
	/** Active system announcements to display as banners. */
	announcements?: ResolvedAnnouncement[];
};

let { children, session = null, isAdmin = false, immersive = false, announcements = [] }: Props = $props();

// Initialize session context so child components can use getSession()
// svelte-ignore state_referenced_locally
const sessionContext = setSessionContext(session);
// The context owns a 1 s expiry timer. The public, account, admin and desk layouts
// each mount their own shell, so a timer left running here leaked one interval per
// layout-group switch for the life of the tab.
onDestroy(() => sessionContext.destroy());

const modals = getModals();
const sidebar = getSidebar();
const theme = getTheme();

// Dynamic Chatbot — loads the chatbot view graph only once the assistant is non-closed.
// The heavy ai / @ai-sdk/svelte graph itself is pulled lazily inside the chatbot-session
// singleton's ensureChat() (first open), keeping it out of the initial page payload.
let ChatbotComponent: typeof import('#lib/components/composites/chatbot/index.ts').Chatbot | null = $state(null);

$effect(() => {
	if (chatbotSession.phase !== 'closed' && !ChatbotComponent) {
		import('#lib/components/composites/chatbot/index.ts').then((m) => {
			ChatbotComponent = m.Chatbot;
		});
	}
});

// The chatbot is docked as a right-hand column on desktop while open; reflow main so
// the panel never overlaps content. Mobile uses a bottom sheet (no horizontal reflow).
// A page that embeds the thread (the chatbot showcase) takes the dock's place.
const chatDocked = $derived(chatbotSession.phase === 'open' && !chatbotSession.embedded);

// Hand the singleton the live user id (resume pointer + cross-user guard + sign-in
// gate). Reactive, not onMount-only: client-side logout (signOutAndFlush →
// refreshAll → goto) updates the session prop WITHOUT remounting this shell, and
// the gate must flip to 'auth_required' right then.
$effect(() => {
	chatbotSession.setUser(session?.user?.id);
});

// If this tab had a live thread before a reload, surface the minimized indicator
// (AI-SDK-free; signed-in only — an anonymous visitor must not adopt a stale pointer).
// Then honor a one-shot reopen intent from the sign-in round-trip: reopen Vely even if
// auth was abandoned — the panel just shows the gate again, which is honest continuity.
onMount(() => {
	if (session?.user?.id) {
		chatbotSession.hydratePointer();
	}
	if (chatbotSession.consumeReopenIntent()) void chatbotSession.open();
});

// The command palette is closed on almost every page view, and it carries bits-ui's
// command + dialog machinery (~10 KB gz) that nothing else in the shell needs. It is
// imported on first open, and warmed once the browser is idle so ⌘K does not wait on
// the network: the bytes still arrive, but after hydration rather than competing with it.
let CommandPalette: typeof import('#lib/components/composites/command-palette/CommandPalette.svelte').default | null =
	$state(null);
function loadCommandPalette(): void {
	if (CommandPalette) return;
	import('#lib/components/composites/command-palette/CommandPalette.svelte').then((mod) => {
		CommandPalette = mod.default;
	});
}
$effect(() => {
	if (modals.quickSearchOpen) loadCommandPalette();
});
onMount(() => {
	const idle = window.requestIdleCallback;
	if (typeof idle === 'function') {
		const handle = idle(loadCommandPalette, { timeout: 4000 });
		return () => window.cancelIdleCallback?.(handle);
	}
	const handle = window.setTimeout(loadCommandPalette, 2000);
	return () => window.clearTimeout(handle);
});

// Universal search engine: instant client lane (prerendered shard) + debounced
// server lane (full-body docs + live blog). Lazy-fetches the shard on first open.
const search = createSearchEngine();
let searchQuery = $state('');
const activeLocale = $derived((page.params.locale ?? 'en') as Locale);

$effect(() => {
	search.setLocale(activeLocale);
});
$effect(() => {
	search.setQuery(searchQuery);
});
$effect(() => {
	if (modals.quickSearchOpen) search.ensureLoaded();
});

const SURFACE_ICON: Record<string, string> = {
	page: 'i-lucide-file-text',
	showcase: 'i-lucide-view',
	section: 'i-lucide-component',
	doc: 'i-lucide-book-open',
	blog: 'i-lucide-newspaper',
};

function toItem(r: SearchResult): CommandPaletteItem {
	return {
		id: r.id,
		type: r.surface,
		label: r.title,
		icon: r.icon ?? SURFACE_ICON[r.surface] ?? 'i-lucide-file',
		href: localizeHref(r.path) + (r.anchor ?? ''),
		hint: r.breadcrumb.length > 0 ? r.breadcrumb.join(' / ') : undefined,
		snippet: r.snippet ?? undefined,
		highlight: r.highlight,
		badge: r.badge,
	};
}

// Merge both lanes, de-duping by destination (server result wins → richer snippet).
const searchResultItems = $derived.by<CommandPaletteItem[]>(() => {
	const byDest = new Map<string, SearchResult>();
	const key = (r: SearchResult) => `${r.surface}:${r.path}:${r.anchor ?? ''}`;
	for (const r of search.instant) byDest.set(key(r), r);
	for (const r of search.async) byDest.set(key(r), r);
	return Array.from(byDest.values()).map(toItem);
});

const panelSearchItems = $derived(
	Object.values(DESK_PANELS).map((p) => ({
		id: `desk-${p.type}`,
		type: 'panel' as const,
		label: p.label,
		icon: p.icon ?? 'i-lucide-layout-grid',
		action: () => goto(`/desk?open=${p.type}`),
		hint: page.url.pathname !== '/desk' ? m.shell_opens_in_desk() : undefined,
		secondary: {
			icon: 'i-lucide-external-link',
			label: m.shell_open_panel_in_new_tab({ panel: p.label }),
			action: () => window.open(`/desk?open=${p.type}`, '_blank'),
		},
	})),
);

const searchItems = $derived<CommandPaletteItem[]>([
	...searchResultItems,
	...panelSearchItems,
	{
		id: 'toggle-theme',
		type: 'action' as const,
		label: m.shell_toggle_theme(),
		icon: 'i-lucide-sun-moon',
		action: () => theme.setMode(theme.isDark ? 'light' : 'dark'),
	},
	{
		id: 'shortcuts',
		type: 'action' as const,
		label: m.shell_keyboard_shortcuts(),
		icon: 'i-lucide-keyboard',
		action: () => modals.open('shortcuts'),
	},
	{
		id: 'ai-assistant',
		type: 'action' as const,
		label: m.shell_ai_assistant(),
		icon: 'i-lucide-bot',
		action: () => chatbotSession.open(),
	},
]);
</script>

<!-- Navigation progress bar -->
<NavigationProgress />

<!-- Skip link for accessibility -->
<a href="#main-content" class="absolute -top-full left-0 py-2 px-4 bg-primary text-white z-modal no-underline focus:top-0">{m.shell_skip_to_main()}</a>

<!-- 100svh, not 100vh/min-h-screen: vh is the LARGE viewport, so with mobile
	browser chrome expanded the bottom of a 100vh box sits below the fold. -->
<div class="flex min-h-[100svh]">
	<Sidebar {isAdmin} />

	<!-- inert while the mobile drawer is open: a screen reader's virtual cursor could
	     otherwise read and activate content behind the scrim (Footer is inside main).
	     Banners/toasts/palette are siblings above the scrim and stay interactive. -->
	<main
		id="main-content"
		tabindex="-1"
		inert={sidebar.mobileOpen}
		class={cn(
			'flex-1 min-w-0 flex flex-col overflow-x-clip md:pl-[var(--sidebar-rail-width)]',
			'transition-[padding] duration-fast motion-reduce:transition-none',
			chatDocked && 'md:pr-[28rem]'
		)}
	>
		{#if announcements.length > 0}
			<AnnouncementBanner {announcements} />
		{/if}
		{@render children?.()}

		{#if !immersive}
			<Footer />
		{/if}
	</main>
</div>

<!-- Consent banner -->
<ConsentBanner />

<!-- Toast notifications -->
<ToastContainer />

<!-- Command palette: universal two-lane search -->
{#if CommandPalette}
	<CommandPalette
		bind:open={modals.quickSearchOpen}
		bind:query={searchQuery}
		items={searchItems}
		mode="search"
		loading={search.status === 'loading'}
	/>
{/if}

<!-- AI assistant chatbot: persistent, minimizable, non-modal. Stays mounted while the
	thread is alive (open|minimized) and no page shows it in place; the live Chat lives in
	the chatbot-session singleton. -->
{#if ChatbotComponent && chatbotSession.phase !== 'closed' && !chatbotSession.embedded}
	<svelte:component this={ChatbotComponent} />
{/if}

<!-- Shortcuts modal -->
<ShortcutsDialog />

<!-- Session lifecycle monitor -->
{#if session}
	<SessionMonitor {session} />
{/if}
