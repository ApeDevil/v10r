<script lang="ts">
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import type { CommandPaletteItem } from '$lib/components/composites/command-palette';
import { CommandPalette } from '$lib/components/composites/command-palette';
import {
	AnnouncementBanner,
	ConsentBanner,
	Footer,
	NavigationProgress,
	SessionMonitor,
	ShortcutsModal,
	Sidebar,
	ToastContainer,
} from '$lib/components/shell';
import { DESK_PANELS } from '$lib/config/desk-panels';
import { localizeHref } from '$lib/i18n/runtime';
import * as m from '$lib/paraglide/messages';
import type { SearchLocale, SearchResult } from '$lib/search/types';
import type { ResolvedAnnouncement } from '$lib/server/admin/announcements';
import { chatbotSession } from '$lib/state/chatbot-session.svelte';
import { getModals } from '$lib/state/modals.svelte';
import { createSearchEngine } from '$lib/state/search.svelte';
import { type Session, setSessionContext } from '$lib/state/session.svelte';
import { getSidebar } from '$lib/state/sidebar.svelte';
import { getTheme } from '$lib/state/theme.svelte';
import { cn } from '$lib/utils/cn';

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
setSessionContext(session);

const modals = getModals();
const sidebar = getSidebar();
const theme = getTheme();

// Dynamic Chatbot — loads the chatbot view graph only once the assistant is non-closed.
// The heavy ai / @ai-sdk/svelte graph itself is pulled lazily inside the chatbot-session
// singleton's ensureChat() (first open), keeping it out of the initial page payload.
let ChatbotComponent: typeof import('$lib/components/composites/chatbot').Chatbot | null = $state(null);

$effect(() => {
	if (chatbotSession.phase !== 'closed' && !ChatbotComponent) {
		import('$lib/components/composites/chatbot').then((m) => {
			ChatbotComponent = m.Chatbot;
		});
	}
});

// The chatbot is docked as a right-hand column on desktop while open; reflow main so
// the panel never overlaps content. Mobile uses a bottom sheet (no horizontal reflow).
const chatDocked = $derived(chatbotSession.phase === 'open');

// Hand the singleton the live user id (resume pointer + cross-user guard) and, if this
// tab had a live thread before a reload, surface the minimized indicator (AI-SDK-free).
onMount(() => {
	if (session?.user?.id) {
		chatbotSession.setUser(session.user.id);
		chatbotSession.hydratePointer();
	}
});

// Universal search engine: instant client lane (prerendered shard) + debounced
// server lane (full-body docs + live blog). Lazy-fetches the shard on first open.
const search = createSearchEngine();
let searchQuery = $state('');
const activeLocale = $derived((page.params.locale ?? 'en') as SearchLocale);

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

<div class="flex min-h-screen">
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
<CommandPalette
	bind:open={modals.quickSearchOpen}
	bind:query={searchQuery}
	items={searchItems}
	mode="search"
	loading={search.status === 'loading'}
/>

<!-- AI assistant chatbot: persistent, minimizable, non-modal. Stays mounted while the
	thread is alive (open|minimized); the live Chat lives in the chatbot-session singleton. -->
{#if ChatbotComponent && chatbotSession.phase !== 'closed'}
	<svelte:component this={ChatbotComponent} />
{/if}

<!-- Shortcuts modal -->
<ShortcutsModal />

<!-- Session lifecycle monitor -->
{#if session}
	<SessionMonitor {session} />
{/if}
