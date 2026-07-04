<script lang="ts">
/**
 * New-version handling (PWA update UX). Two tiers, never interruptive:
 *
 * Tier 1 — silent update-on-navigation: when a new build is live and the user
 * navigates anyway, the client-side nav is converted into a full-page load
 * (which picks up the new assets) and the waiting service worker is told to
 * activate. The reload rides a navigation the user already asked for.
 *
 * Tier 2 — long sessions that never navigate (parked in the chatbot / a long
 * doc) get ONE persistent toast with a Reload action after 30 minutes.
 *
 * `controllerchange` reloads every open tab together once a new worker takes
 * over — this closes the multi-tab skew hole (tab A updates, tab B would keep
 * running old code against deleted caches).
 */
import { beforeNavigate } from '$app/navigation';
import { updated } from '$app/state';
import * as m from '$lib/paraglide/messages';
import { getToast } from '$lib/state/toast.svelte';

const IDLE_PROMPT_MS = 30 * 60 * 1000;

const toast = getToast();

let registration: ServiceWorkerRegistration | undefined;
let prompted = false;
// One-shot: controllerchange can fire more than once (notably with DevTools
// "Update on reload"), and an unguarded reload-on-controllerchange is the
// documented infinite-reload-loop pattern.
let reloading = false;

function reloadOnce() {
	if (reloading) return;
	reloading = true;
	location.reload();
}

function activateAndReload() {
	registration?.waiting?.postMessage('SKIP_WAITING');
	// controllerchange normally triggers the reload; the timeout covers the
	// no-waiting-worker case (version poll detected a deploy before the SW did).
	setTimeout(reloadOnce, 300);
}

$effect(() => {
	if (!('serviceWorker' in navigator)) return;
	navigator.serviceWorker.getRegistration().then((reg) => {
		registration = reg;
	});
	navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);
	return () => navigator.serviceWorker.removeEventListener('controllerchange', reloadOnce);
});

// Tier 1 — ride the user's own navigation.
beforeNavigate((nav) => {
	if (!updated.current) return;
	// Full-page loads and external leaves already fetch fresh assets.
	if (!nav.to?.url || nav.willUnload || nav.type === 'leave') return;
	registration?.waiting?.postMessage('SKIP_WAITING');
	nav.cancel();
	location.href = nav.to.url.href;
});

// Tier 2 — one polite prompt for navigation-less sessions.
$effect(() => {
	if (!updated.current || prompted) return;
	const timer = setTimeout(() => {
		if (prompted) return;
		// Stay quiet mid-input — the next navigation updates silently anyway.
		const active = document.activeElement?.tagName;
		if (active === 'INPUT' || active === 'TEXTAREA') return;
		prompted = true;
		toast.show({
			type: 'info',
			message: m.shell_update_available(),
			duration: 0,
			action: { label: m.shell_update_reload(), onclick: activateAndReload },
		});
	}, IDLE_PROMPT_MS);
	return () => clearTimeout(timer);
});
</script>
