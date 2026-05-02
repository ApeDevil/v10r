<script lang="ts">
import 'uno.css';
import '../app.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/nunito';
import { Tooltip as TooltipPrimitive } from 'bits-ui';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { initJourneyBeacon } from '$lib/analytics/journey-beacon';
import favicon from '$lib/assets/favicon.svg';
import { BRAND_NAME } from '$lib/branding';
import { localizeHref } from '$lib/i18n';
import { initKeyboardHandler, registerShortcut } from '$lib/shortcuts';
import { setConsentContext } from '$lib/state/consent.svelte';
import { setModalsContext } from '$lib/state/modals.svelte';
import { setSidebarContext } from '$lib/state/sidebar.svelte';
import { setStyleContext } from '$lib/state/style.svelte';
import { setThemeContext } from '$lib/state/theme.svelte';
import { setToastContext } from '$lib/state/toast.svelte';

let { children, data } = $props();

// Initialize all shell contexts (SSR-safe, request-scoped)
// svelte-ignore state_referenced_locally
const theme = setThemeContext({
	mode: data.themeMode,
	accent: 'blue',
});
// svelte-ignore state_referenced_locally
const sidebar = setSidebarContext(data.sidebarWidth);
const modals = setModalsContext();
const toast = setToastContext();
// svelte-ignore state_referenced_locally
const styleState = setStyleContext(data.style);
const consent = setConsentContext();

// Sync style state when server data changes (e.g. after navigation)
$effect(() => {
	styleState.update(data.style);
});

// SPA-navigation analytics beacon (idempotent, no-op when consent < 'analytics' is rejected server-side)
$effect(() => {
	initJourneyBeacon();
});

// Keyboard shortcuts
$effect(() => {
	const cleanup = initKeyboardHandler();

	const unregisterSearch = registerShortcut({
		id: 'quicksearch',
		keys: 'mod+k',
		description: 'Search anything',
		category: 'global',
		action: () => modals.toggle('quickSearch'),
	});

	const unregisterAI = registerShortcut({
		id: 'ai-assistant',
		keys: 'mod+j',
		description: 'AI help',
		category: 'global',
		action: () => modals.toggle('aiAssistant'),
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

	const unregisterHome = registerShortcut({
		id: 'nav-home',
		keys: 'g h',
		description: 'Navigate home',
		category: 'navigation',
		action: () => goto(localizeHref('/')),
	});

	const unregisterSettings = registerShortcut({
		id: 'nav-settings',
		keys: 'g s',
		description: 'Navigate settings',
		category: 'navigation',
		action: () => goto(localizeHref('/settings')),
	});

	const unregisterDocs = registerShortcut({
		id: 'nav-docs',
		keys: 'g d',
		description: 'Navigate docs',
		category: 'navigation',
		action: () => goto(localizeHref('/docs')),
	});

	const unregisterShuffle = registerShortcut({
		id: 'shuffle-style',
		keys: 'mod+shift+r',
		description: 'Shuffle Style',
		category: 'global',
		action: () => styleState.roll(toast),
	});

	return () => {
		cleanup();
		unregisterSearch();
		unregisterAI();
		unregisterHelp();
		unregisterEscape();
		unregisterHome();
		unregisterSettings();
		unregisterDocs();
		unregisterShuffle();
	};
});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{page.data.title ? `${page.data.title} - ${BRAND_NAME}` : BRAND_NAME}</title>
</svelte:head>

<TooltipPrimitive.Provider>
	{@render children()}
</TooltipPrimitive.Provider>

<div class="sr-only" aria-live="polite" aria-atomic="true">
	{styleState.announcement}
</div>
