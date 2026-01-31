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
<a href="#main-content" class="skip-link">Skip to main content</a>

<div class="app-shell">
	<Sidebar />

	<main id="main-content" tabindex="-1" class="main-content">
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

<style>
	.skip-link {
		position: absolute;
		top: -100%;
		left: 0;
		padding: 0.5rem 1rem;
		background: var(--color-primary);
		color: white;
		z-index: 9999;
		text-decoration: none;
	}

	.skip-link:focus {
		top: 0;
	}

	.app-shell {
		display: flex;
		min-height: 100dvh;
	}

	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
</style>
