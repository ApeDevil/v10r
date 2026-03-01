<script lang="ts">
	import {
		Sidebar,
		Footer,
		ToastContainer,
		NavigationProgress,
		ShortcutsModal,
		SessionMonitor,
	} from '$lib/components/shell';
	import { QuickSearch } from '$lib/components/composites/quick-search';
	import { Chatbot } from '$lib/components/composites/chatbot';
	import { setSessionContext, type Session } from '$lib/state/session.svelte';
	import { getModals } from '$lib/state/modals.svelte';
	import { getTheme } from '$lib/state/theme.svelte';
	import { DESK_PANELS } from '$lib/config/desk-panels';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	type Props = {
		children?: import('svelte').Snippet;
		session?: Session;
	};

	let { children, session = null }: Props = $props();

	// Initialize session context so child components can use getSession()
	setSessionContext(session);

	const modals = getModals();
	const theme = getTheme();

	function pageItem(id: string, label: string, icon: string, href: string) {
		return {
			id,
			type: 'page' as const,
			label,
			icon,
			href,
			secondary: {
				icon: 'i-lucide-external-link',
				label: 'Open in new tab',
				action: () => window.open(href, '_blank'),
			},
		};
	}

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
		}))
	);

	const searchItems = $derived([
		pageItem('home', 'Home', 'i-lucide-home', '/'),
		pageItem('dashboard', 'Dashboard', 'i-lucide-layout-dashboard', '/app/dashboard'),
		pageItem('account', 'Account', 'i-lucide-user', '/app/account'),
		pageItem('sign-in', 'Sign in', 'i-lucide-key', '/auth/login'),
		pageItem('showcases', 'Showcases', 'i-lucide-eye', '/showcases'),
		pageItem('showcases-shell', 'Shell', 'i-lucide-layout', '/showcases/shell'),
		pageItem('showcases-forms', 'Forms', 'i-lucide-file-text', '/showcases/forms'),
		pageItem('showcases-3d', '3D', 'i-lucide-box', '/showcases/3d'),
		pageItem('showcases-auth', 'Auth', 'i-lucide-lock', '/showcases/auth'),
		pageItem('docs', 'Docs', 'i-lucide-book-open', '/docs'),
		pageItem('docs-stack', 'Stack', 'i-lucide-layers', '/docs/stack'),
		pageItem('showcases-ai', 'AI', 'i-lucide-bot', '/showcases/ai'),
		...panelSearchItems,
		{ id: 'toggle-theme', type: 'action' as const, label: 'Toggle Theme', icon: 'i-lucide-sun-moon', action: () => theme.setMode(theme.isDark ? 'light' : 'dark') },
		{ id: 'shortcuts', type: 'action' as const, label: 'Keyboard Shortcuts', icon: 'i-lucide-keyboard', action: () => modals.open('shortcuts') },
		{ id: 'ai-assistant', type: 'action' as const, label: 'AI Assistant', icon: 'i-lucide-bot', action: () => modals.open('aiAssistant') },
	]);
</script>

<!-- Navigation progress bar -->
<NavigationProgress />

<!-- Skip link for accessibility -->
<a href="#main-content" class="absolute -top-full left-0 py-2 px-4 bg-primary text-white z-modal no-underline focus:top-0">Skip to main content</a>

<div class="flex min-h-screen">
	<Sidebar />

	<main id="main-content" tabindex="-1" class="flex-1 min-w-0 flex flex-col overflow-x-clip md:pl-[var(--sidebar-rail-width)]">
		{@render children?.()}

		<Footer />
	</main>
</div>

<!-- Toast notifications -->
<ToastContainer />

<!-- Quick search (command palette) -->
<QuickSearch bind:open={modals.quickSearchOpen} items={searchItems} />

<!-- AI assistant chatbot -->
<Chatbot bind:open={modals.aiAssistantOpen} />

<!-- Shortcuts modal -->
<ShortcutsModal />

<!-- Session lifecycle monitor -->
{#if session}
	<SessionMonitor {session} />
{/if}
