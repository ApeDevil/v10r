<script lang="ts">
import type { Snippet } from 'svelte';
import { afterNavigate } from '$app/navigation';
import { page } from '$app/state';
import { Typography } from '$lib/components/primitives';
import { deLocalizeHref, localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';

let { children }: { children: Snippet } = $props();

const tabs = [
	{ href: '/admin/analytics/human', label: m.admin_analytics_tab_human() },
	{ href: '/admin/analytics/bots', label: m.admin_analytics_tab_bots() },
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

<section class="analytics-section">
	<header class="analytics-header">
		<Typography variant="h1">{m.admin_analytics_section_title()}</Typography>
		<nav class="analytics-tabs" aria-label={m.admin_analytics_section_title()}>
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
		class="analytics-content"
		tabindex="-1"
		bind:this={contentEl}
		aria-label={m.admin_nav_panel_aria({ name: (activeTab ?? tabs[0]).label })}
	>
		{@render children()}
	</div>
</section>

<style>
	.analytics-header {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--spacing-3);
		margin-bottom: var(--spacing-5);
	}

	/* Horizontal scroll instead of clipping on narrow viewports. */
	.analytics-tabs {
		display: flex;
		gap: var(--spacing-4);
		overflow-x: auto;
		scrollbar-width: thin;
		max-width: 100%;
	}

	.analytics-tabs a {
		color: var(--color-muted);
		text-decoration: none;
		white-space: nowrap;
		padding-bottom: var(--spacing-1);
		border-bottom: 2px solid transparent;
		transition: color 150ms ease, border-color 150ms ease;
	}

	.analytics-tabs a:hover {
		color: var(--color-fg);
	}

	.analytics-tabs a.active {
		color: var(--color-fg);
		border-bottom-color: var(--color-primary);
	}

	.analytics-tabs a:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	/* Focus target for post-navigation focus; no visible outline since it's
	   programmatic, not user-driven. */
	.analytics-content:focus {
		outline: none;
	}
</style>
