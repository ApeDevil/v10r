<script lang="ts">
import type { Snippet } from 'svelte';
import { afterNavigate } from '$app/navigation';
import { page } from '$app/state';
import { Typography } from '$lib/components/primitives';
import { deLocalizeHref, localizeHref } from '$lib/i18n';

let { children }: { children: Snippet } = $props();

const tabs = [
	{ href: '/admin/ai/overview', label: 'Overview' },
	{ href: '/admin/ai/models', label: 'Models' },
	{ href: '/admin/ai/usage', label: 'Usage' },
	{ href: '/admin/ai/cost', label: 'Cost' },
	{ href: '/admin/ai/nrag', label: 'nRAG' },
	{ href: '/admin/ai/tools', label: 'Tools' },
];

const isActive = (href: string) => deLocalizeHref(page.url.pathname).startsWith(href);
const activeTab = $derived(tabs.find((t) => isActive(t.href)));

// SvelteKit doesn't move focus on client navigation; without this, keyboard /
// screen-reader users lose their place each time they switch tab. Skip the
// initial hydration ('enter') so we only move focus on real tab changes.
let contentEl = $state<HTMLDivElement>();
afterNavigate(({ type }) => {
	if (type !== 'enter') contentEl?.focus();
});
</script>

<section class="ai-section">
	<header class="ai-header">
		<Typography variant="h1">AI</Typography>
		<nav class="ai-tabs" aria-label="AI section">
			{#each tabs as t (t.href)}
				<a
					href={localizeHref(t.href)}
					class:active={isActive(t.href)}
					aria-current={isActive(t.href) ? 'page' : undefined}
				>{t.label}</a>
			{/each}
		</nav>
	</header>

	<div
		class="ai-content"
		tabindex="-1"
		bind:this={contentEl}
		aria-label={activeTab ? `${activeTab.label} panel` : 'AI panel'}
	>
		{@render children()}
	</div>
</section>

<style>
	.ai-header {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-3);
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-5);
	}

	/* Horizontal scroll instead of clipping on narrow viewports. */
	.ai-tabs {
		display: flex;
		gap: var(--spacing-4);
		overflow-x: auto;
		scrollbar-width: thin;
		max-width: 100%;
	}

	.ai-tabs a {
		color: var(--color-muted);
		text-decoration: none;
		white-space: nowrap;
		padding-bottom: var(--spacing-1);
		border-bottom: 2px solid transparent;
		transition: color 150ms ease, border-color 150ms ease;
	}

	.ai-tabs a:hover {
		color: var(--color-fg);
	}

	.ai-tabs a.active {
		color: var(--color-fg);
		border-bottom-color: var(--color-primary);
	}

	.ai-tabs a:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	/* Focus target for post-navigation focus; no visible outline since it's
	   programmatic, not user-driven. */
	.ai-content:focus {
		outline: none;
	}
</style>
