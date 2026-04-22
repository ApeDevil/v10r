<script lang="ts">
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
import { searchPages } from '$lib/nav';
import type { ActiveAnnouncement } from '$lib/server/admin/announcements';
import { getModals } from '$lib/state/modals.svelte';
import { type Session, setSessionContext } from '$lib/state/session.svelte';
import { getTheme } from '$lib/state/theme.svelte';

type Props = {
	children?: import('svelte').Snippet;
	session?: Session;
	/** Whether the current user has admin privileges. */
	isAdmin?: boolean;
	/** Immersive mode: hides the footer for full-viewport layouts like the desk. */
	immersive?: boolean;
	/** Active system announcements to display as banners. */
	announcements?: ActiveAnnouncement[];
};

let { children, session = null, isAdmin = false, immersive = false, announcements = [] }: Props = $props();

// Initialize session context so child components can use getSession()
// svelte-ignore state_referenced_locally
setSessionContext(session);

const modals = getModals();
const theme = getTheme();

// Dynamic Chatbot — loads the ai / @ai-sdk/svelte / bits-ui Dialog module graph only when the user opens the assistant.
// Prevents the heavy AI SDK bundle from being part of the initial page payload.
let ChatbotComponent: typeof import('$lib/components/composites/chatbot').Chatbot | null = $state(null);

$effect(() => {
	if (modals.aiAssistantOpen && !ChatbotComponent) {
		import('$lib/components/composites/chatbot').then((m) => {
			ChatbotComponent = m.Chatbot;
		});
	}
});

const pageSearchItems = searchPages.map((p) => ({
	id: p.id,
	type: 'page' as const,
	label: p.label,
	icon: p.icon,
	href: p.href,
	hint: p.hint,
	secondary: {
		icon: 'i-lucide-external-link',
		label: 'Open in new tab',
		action: () => window.open(p.href, '_blank'),
	},
}));

const panelSearchItems = $derived(
	Object.values(DESK_PANELS).map((p) => ({
		id: `desk-${p.type}`,
		type: 'panel' as const,
		label: p.label,
		icon: p.icon ?? 'i-lucide-layout-grid',
		action: () => goto(`/desk?open=${p.type}`),
		hint: page.url.pathname !== '/desk' ? 'Opens in Desk' : undefined,
		secondary: {
			icon: 'i-lucide-external-link',
			label: `Open ${p.label} in new tab`,
			action: () => window.open(`/desk?open=${p.type}`, '_blank'),
		},
	})),
);

const searchItems = $derived<CommandPaletteItem[]>([
	...pageSearchItems,
	...panelSearchItems,
	{
		id: 'toggle-theme',
		type: 'action' as const,
		label: 'Toggle Theme',
		icon: 'i-lucide-sun-moon',
		action: () => theme.setMode(theme.isDark ? 'light' : 'dark'),
	},
	{
		id: 'shortcuts',
		type: 'action' as const,
		label: 'Keyboard Shortcuts',
		icon: 'i-lucide-keyboard',
		action: () => modals.open('shortcuts'),
	},
	{
		id: 'ai-assistant',
		type: 'action' as const,
		label: 'AI Assistant',
		icon: 'i-lucide-bot',
		action: () => modals.open('aiAssistant'),
	},
]);
</script>

<!-- Navigation progress bar -->
<NavigationProgress />

<!-- Skip link for accessibility -->
<a href="#main-content" class="absolute -top-full left-0 py-2 px-4 bg-primary text-white z-modal no-underline focus:top-0">Skip to main content</a>

<div class="flex min-h-screen">
	<Sidebar {isAdmin} />

	<main id="main-content" tabindex="-1" class="flex-1 min-w-0 flex flex-col overflow-x-clip md:pl-[var(--sidebar-rail-width)]">
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

<!-- Command palette -->
<CommandPalette bind:open={modals.quickSearchOpen} items={searchItems} />

<!-- AI assistant chatbot: dynamically imported on first open (keeps the ai/@ai-sdk/svelte graph out of the initial page payload) -->
{#if ChatbotComponent && modals.aiAssistantOpen}
	<svelte:component this={ChatbotComponent} bind:open={modals.aiAssistantOpen} />
{/if}

<!-- Shortcuts modal -->
<ShortcutsModal />

<!-- Session lifecycle monitor -->
{#if session}
	<SessionMonitor {session} />
{/if}
