<script lang="ts">
	import {
		Sidebar,
		Footer,
		ToastContainer,
		NavigationProgress,
		ShortcutsModal,
		SessionMonitor,
	} from '$lib/components/shell';
	import type { Session } from '$lib/stores/session.svelte';

	type Props = {
		children?: import('svelte').Snippet;
		session?: Session;
	};

	let { children, session = null }: Props = $props();
</script>

<!-- Navigation progress bar -->
<NavigationProgress />

<!-- Skip link for accessibility -->
<a href="#main-content" class="absolute -top-full left-0 py-2 px-4 bg-primary text-white z-modal no-underline focus:top-0">Skip to main content</a>

<div class="flex min-h-screen">
	<Sidebar />

	<main id="main-content" tabindex="-1" class="flex-1 flex flex-col">
		{@render children?.()}

		<Footer />
	</main>
</div>

<!-- Toast notifications -->
<ToastContainer />

<!-- Shortcuts modal -->
<ShortcutsModal />

<!-- Session lifecycle monitor -->
{#if session}
	<SessionMonitor {session} />
{/if}
