<script lang="ts">
	import 'uno.css';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { AppShell } from '$lib/components/shell';
	import { setSidebarContext } from '$lib/stores/sidebar.svelte';
	import { setThemeContext } from '$lib/stores/theme.svelte';
	import { setModalsContext } from '$lib/stores/modals.svelte';
	import { setToastContext } from '$lib/stores/toast.svelte';
	import { initKeyboardHandler, registerShortcut } from '$lib/shortcuts';
	import { goto } from '$app/navigation';
	import { Tooltip as TooltipPrimitive } from 'bits-ui';

	let { children, data } = $props();

	// Initialize all shell contexts (SSR-safe, request-scoped)
	// 1. Theme (sync with cookie/system preference)
	const theme = setThemeContext({
		mode: 'system', // TODO: Load from user preferences
		accent: 'blue',
	});

	// 2. Sidebar (loads from localStorage on client)
	const sidebar = setSidebarContext();

	// 3. Modals (ephemeral client state)
	const modals = setModalsContext();

	// 4. Toast (ephemeral client state)
	const toast = setToastContext();

	// 5. Keyboard shortcuts (Phase 5)
	$effect(() => {
		// Initialize keyboard handler
		const cleanup = initKeyboardHandler();

		// Register default shortcuts

		// Global shortcuts
		const unregisterSearch = registerShortcut({
			id: 'quicksearch',
			keys: 'mod+k',
			description: 'Search anything',
			category: 'global',
			action: () => modals.open('quickSearch'),
		});

		const unregisterAI = registerShortcut({
			id: 'ai-assistant',
			keys: 'mod+j',
			description: 'AI help',
			category: 'global',
			action: () => modals.open('aiAssistant'),
		});

		const unregisterHelp = registerShortcut({
			id: 'shortcuts-help',
			keys: 'shift+/',
			description: 'Show keyboard shortcuts',
			category: 'global',
			action: () => modals.open('shortcuts'),
		});

		const unregisterEscape = registerShortcut({
			id: 'close-modal',
			keys: 'escape',
			description: 'Close current modal',
			category: 'global',
			action: () => modals.close(),
		});

		// Navigation shortcuts
		const unregisterHome = registerShortcut({
			id: 'nav-home',
			keys: 'g h',
			description: 'Navigate home',
			category: 'navigation',
			action: () => goto('/'),
		});

		const unregisterSettings = registerShortcut({
			id: 'nav-settings',
			keys: 'g s',
			description: 'Navigate settings',
			category: 'navigation',
			action: () => goto('/settings'),
		});

		const unregisterDocs = registerShortcut({
			id: 'nav-docs',
			keys: 'g d',
			description: 'Navigate docs',
			category: 'navigation',
			action: () => goto('/docs'),
		});

		// Cleanup on unmount
		return () => {
			cleanup();
			unregisterSearch();
			unregisterAI();
			unregisterHelp();
			unregisterEscape();
			unregisterHome();
			unregisterSettings();
			unregisterDocs();
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<TooltipPrimitive.Provider>
	<AppShell session={data.session}>
		{@render children()}
	</AppShell>
</TooltipPrimitive.Provider>
