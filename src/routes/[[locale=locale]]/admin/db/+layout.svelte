<script lang="ts">
import type { Snippet } from 'svelte';
import { afterNavigate } from '$app/navigation';
import { page } from '$app/state';
import { Typography } from '$lib/components/primitives';
import { deLocalizeHref, localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';

let { children }: { children: Snippet } = $props();

const tabs = [
	{ href: '/admin/db/observe', label: m.admin_db_tab_observe() },
	{ href: '/admin/db/mirror', label: m.admin_db_tab_mirror() },
	{ href: '/admin/db/runs', label: m.admin_db_tab_runs() },
];

const isActive = (href: string) => deLocalizeHref(page.url.pathname).startsWith(href);
const activeTab = $derived(tabs.find((t) => isActive(t.href)));

// Move focus on real tab changes (not initial hydration) for keyboard/SR users.
let contentEl = $state<HTMLDivElement>();
afterNavigate(({ type }) => {
	if (type !== 'enter') contentEl?.focus();
});
</script>

<section class="db-section">
	<header class="db-header">
		<Typography variant="h1">{m.admin_db_section_title()}</Typography>
		<nav class="db-tabs" aria-label={m.admin_db_section_title()}>
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
		class="db-content"
		tabindex="-1"
		bind:this={contentEl}
		aria-label={activeTab ? `${activeTab.label} panel` : 'Database panel'}
	>
		{@render children()}
	</div>
</section>

<style>
	.db-header {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--spacing-3);
		margin-bottom: var(--spacing-5);
	}

	.db-tabs {
		display: flex;
		gap: var(--spacing-4);
		overflow-x: auto;
		scrollbar-width: thin;
		max-width: 100%;
	}

	.db-tabs a {
		color: var(--color-muted);
		text-decoration: none;
		white-space: nowrap;
		padding-bottom: var(--spacing-1);
		border-bottom: 2px solid transparent;
		transition: color 150ms ease, border-color 150ms ease;
	}

	.db-tabs a:hover {
		color: var(--color-fg);
	}

	.db-tabs a.active {
		color: var(--color-fg);
		border-bottom-color: var(--color-primary);
	}

	.db-tabs a:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.db-content:focus {
		outline: none;
	}
</style>
