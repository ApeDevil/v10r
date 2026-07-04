<script lang="ts">
/**
 * Offline fallback — precached by the service worker and served for any
 * navigation that fails on the network. Self-contained by design: no AppShell,
 * no load functions, and all three locales inline (a prerendered fallback
 * can't resolve the runtime locale of whatever page the user tried to reach).
 */
import { Button } from '$lib/components/primitives';
</script>

<svelte:head>
	<title>Offline · v10r</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="offline">
	<img src="/icons/icon-192.png" alt="" width="96" height="96" class="offline-logo" />
	<h1 class="offline-title">You're offline</h1>
	<p class="offline-line">This page needs a connection. Your data is safe — try again once you're back online.</p>
	<p class="offline-line offline-alt" lang="de">Du bist offline. Diese Seite braucht eine Verbindung — versuch es wieder, sobald du online bist.</p>
	<p class="offline-line offline-alt" lang="ru">Вы офлайн. Этой странице нужно соединение — попробуйте снова, когда появится сеть.</p>
	<Button size="lg" onclick={() => location.reload()}>Retry · Erneut versuchen · Повторить</Button>
</main>

<style>
	.offline {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-4);
		padding: var(--spacing-6);
		padding-bottom: max(var(--spacing-6), env(safe-area-inset-bottom, 0px));
		text-align: center;
		background: var(--color-bg);
		color: var(--color-fg);
	}

	.offline-logo {
		opacity: 0.85;
	}

	.offline-title {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
	}

	.offline-line {
		max-width: 34rem;
		font-size: var(--text-fluid-sm);
		line-height: 1.5;
	}

	.offline-alt {
		color: var(--color-muted);
	}
</style>
