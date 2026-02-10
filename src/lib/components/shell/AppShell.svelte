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
	import { setSessionContext, type Session } from '$lib/stores/session.svelte';
	import { getModals } from '$lib/stores/modals.svelte';
	import { getTheme } from '$lib/stores/theme.svelte';

	type Props = {
		children?: import('svelte').Snippet;
		session?: Session;
	};

	let { children, session = null }: Props = $props();

	// Initialize session context so child components can use getSession()
	setSessionContext(session);

	const modals = getModals();
	const theme = getTheme();

	const searchItems = [
		{ id: 'home', type: 'page' as const, label: 'Home', icon: 'i-lucide-home', href: '/' },
		{ id: 'showcases', type: 'page' as const, label: 'Showcases', icon: 'i-lucide-sparkles', href: '/showcases' },
		{ id: 'showcases-shell', type: 'page' as const, label: 'Shell', icon: 'i-lucide-layout', href: '/showcases/shell' },
		{ id: 'showcases-forms', type: 'page' as const, label: 'Forms', icon: 'i-lucide-file-text', href: '/showcases/forms' },
		{ id: 'showcases-3d', type: 'page' as const, label: '3D', icon: 'i-lucide-box', href: '/showcases/3d' },
		{ id: 'showcases-auth', type: 'page' as const, label: 'Auth', icon: 'i-lucide-lock', href: '/showcases/auth' },
		{ id: 'docs', type: 'page' as const, label: 'Docs', icon: 'i-lucide-book-open', href: '/docs' },
		{ id: 'docs-stack', type: 'page' as const, label: 'Stack', icon: 'i-lucide-layers', href: '/docs/stack' },
		{ id: 'toggle-theme', type: 'action' as const, label: 'Toggle Theme', icon: 'i-lucide-sun-moon', action: () => theme.setMode(theme.isDark ? 'light' : 'dark') },
		{ id: 'shortcuts', type: 'action' as const, label: 'Keyboard Shortcuts', icon: 'i-lucide-keyboard', action: () => modals.open('shortcuts') },
	];
</script>

<!-- Navigation progress bar -->
<NavigationProgress />

<!-- Skip link for accessibility -->
<a href="#main-content" class="absolute -top-full left-0 py-2 px-4 bg-primary text-white z-modal no-underline focus:top-0">Skip to main content</a>

<div class="flex min-h-screen">
	<Sidebar />

	<main id="main-content" tabindex="-1" class="flex-1 min-w-0 flex flex-col overflow-x-clip pt-8 md:pl-[var(--sidebar-rail-width)]">
		{@render children?.()}

		<Footer />
	</main>
</div>

<!-- Toast notifications -->
<ToastContainer />

<!-- Quick search (command palette) -->
<QuickSearch bind:open={modals.quickSearchOpen} items={searchItems} />

<!-- Shortcuts modal -->
<ShortcutsModal />

<!-- Session lifecycle monitor -->
{#if session}
	<SessionMonitor {session} />
{/if}
