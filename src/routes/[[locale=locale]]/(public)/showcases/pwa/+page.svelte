<script lang="ts">
/**
 * PWA showcase — documentation, test surface, and reusable pattern in one.
 * The live cards read the real install/service-worker state of this very page;
 * the tables document the caching contract implemented in src/service-worker.ts
 * and $lib/pwa/sw-policy.ts.
 */
import { onMount } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';
import { Card, PageHeader } from '$lib/components/composites';
import { PageContainer, Stack } from '$lib/components/layout';
import { Badge, Button } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';

const standaloneQuery = new MediaQuery('(display-mode: standalone)', false);

let swSupported = $state(false);
let swController = $state(false);
let installPrompt: (Event & { prompt: () => Promise<void> }) | null = $state(null);
let installed = $derived(standaloneQuery.current);

onMount(() => {
	swSupported = 'serviceWorker' in navigator;
	swController = !!navigator.serviceWorker?.controller;
	navigator.serviceWorker?.ready.then(() => {
		swController = !!navigator.serviceWorker.controller;
	});

	// Chromium fires this when the page qualifies for install; stash it and
	// surface the button on user engagement — never auto-prompt.
	const onBeforeInstall = (e: Event) => {
		e.preventDefault();
		installPrompt = e as Event & { prompt: () => Promise<void> };
	};
	window.addEventListener('beforeinstallprompt', onBeforeInstall);
	return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
});
</script>

<PageContainer class="py-7">
	<PageHeader
		title={m.showcase_pwa_title()}
		description={m.showcase_pwa_description()}
		breadcrumbs={[
			{ label: m.showcase_breadcrumb_home(), href: '/' },
			{ label: m.showcase_breadcrumb_showcases(), href: '/showcases' },
			{ label: m.showcase_pwa_breadcrumb() }
		]}
	/>

	<Stack gap="6">
		<!-- Live install state -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_pwa_section_install()}</h2>
			{/snippet}

			<div class="explanation">
				<div class="status-row">
					<span>Running as installed app</span>
					<Badge variant={installed ? 'success' : 'default'}>{installed ? 'standalone' : 'browser tab'}</Badge>
				</div>
				<div class="status-row">
					<span>Service worker</span>
					<Badge variant={swController ? 'success' : swSupported ? 'warning' : 'default'}>
						{swController ? 'controlling this page' : swSupported ? 'registered, not controlling yet' : 'unsupported'}
					</Badge>
				</div>
				{#if installPrompt && !installed}
					<div class="status-row">
						<span>This browser offers a native install prompt</span>
						<Button size="sm" onclick={() => installPrompt?.prompt()}>Install</Button>
					</div>
				{:else if !installed}
					<p>
						On iOS: Share → <strong>Add to Home Screen</strong>. Installability comes from the manifest alone —
						Chrome dropped its service-worker requirement, and iOS 26 defaults the "Open as Web App" toggle to on.
					</p>
				{/if}
				<p>
					The manifest is a dynamic endpoint (<code>/manifest.webmanifest</code>) so its name and description localize
					via the Paraglide cookie — the <code>&lt;link&gt;</code> carries <code>crossorigin="use-credentials"</code>,
					without which manifest fetches omit cookies entirely.
				</p>
			</div>
		</Card>

		<!-- Caching contract -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_pwa_section_policy()}</h2>
			{/snippet}

			<div class="explanation">
				<p>
					"Offline-capable" is scoped honestly: an installable shell with instant repeat loads and a branded
					<code>/offline</code> fallback — <em>not</em> offline CRUD. Every HTML response here is personalized
					(per-user palette injection), so pages are never cached; nothing user-specific can ever enter a cache.
				</p>
				<div class="diag-grid">
					<div class="diag-row">
						<span class="diag-label">Hashed build assets</span>
						<span class="diag-value">precached + cache-first — immortal by URL, survives deploys</span>
					</div>
					<div class="diag-row">
						<span class="diag-label">HTML + __data.json</span>
						<span class="diag-value">network-only, all routes — offline falls back to <code class="diag-mono">/offline</code></span>
					</div>
					<div class="diag-row">
						<span class="diag-label">/api/*, SSE, non-GET</span>
						<span class="diag-value">never intercepted at all (streams must not pass through respondWith)</span>
					</div>
					<div class="diag-row">
						<span class="diag-label">Query-stringed URLs</span>
						<span class="diag-value">refused, never normalized — cache-key hygiene (SvelteSpill-class guard)</span>
					</div>
					<div class="diag-row">
						<span class="diag-label">Sign-out</span>
						<span class="diag-value">Clear-Site-Data header + explicit worker cache flush</span>
					</div>
				</div>
				<p>
					The rules live in a pure module (<code>$lib/pwa/sw-policy.ts</code>) with unit tests asserting
					<code>/admin</code>, <code>/api</code>, and query-stringed URLs are refused — the caching policy is
					testable, not just commented.
				</p>
			</div>
		</Card>

		<!-- Updates -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_pwa_section_update()}</h2>
			{/snippet}

			<div class="explanation">
				<p>
					No automatic <code>skipWaiting()</code> — swapping workers mid-session is how deploys break running tabs.
					Instead:
				</p>
				<div class="diag-grid">
					<div class="diag-row">
						<span class="diag-label">Tier 1 — silent</span>
						<span class="diag-value">a pending update converts the next navigation into a full-page load</span>
					</div>
					<div class="diag-row">
						<span class="diag-label">Tier 2 — prompt</span>
						<span class="diag-value">navigation-less sessions get one persistent "Reload" toast after 30 min</span>
					</div>
					<div class="diag-row">
						<span class="diag-label">Multi-tab</span>
						<span class="diag-value">controllerchange reloads every open tab together</span>
					</div>
					<div class="diag-row">
						<span class="diag-label">Kill switch</span>
						<span class="diag-value">a flag in the worker evacuates all installed clients on the next deploy</span>
					</div>
				</div>
				<p>
					Cache names key on the deploy's commit SHA (<code>kit.version.name</code>). The accepted cost of the
					built-in <code>$service-worker</code> approach: each deploy re-downloads the precache in the background —
					the old worker keeps serving its own consistent cache until the swap.
				</p>
			</div>
		</Card>
	</Stack>
</PageContainer>

<style>
	.explanation {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
	}

	.explanation p {
		margin: 0;
	}

	.status-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-3);
	}

	.diag-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.diag-row {
		display: flex;
		gap: var(--spacing-3);
		align-items: baseline;
	}

	.diag-label {
		flex-shrink: 0;
		width: 10rem;
		font-weight: 600;
		color: var(--color-muted);
	}

	.diag-value {
		min-width: 0;
	}

	.diag-mono,
	code {
		font-family: monospace;
		font-size: 0.9em;
	}
</style>
