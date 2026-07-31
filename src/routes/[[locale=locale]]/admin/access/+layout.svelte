<script lang="ts">
import type { Snippet } from 'svelte';
import { page } from '$app/state';
import { Typography } from '$lib/components/primitives';
import { deLocalizeHref, localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import type { LayoutData } from './$types';

let { children, data }: { children: Snippet; data: LayoutData } = $props();

const tabs = $derived([
	{ href: '/admin/access/authors', label: m.admin_nav_authors() },
	{ href: '/admin/access/requests', label: `${m.admin_nav_requests()} (${data.pendingRequestsCount})` },
]);

// deLocalize before matching, localize before rendering — raw pathname
// comparison broke this tab strip under /de and /ru.
const isActive = (href: string) => deLocalizeHref(page.url.pathname).startsWith(href);
</script>

<div class="access">
	<header>
		<Typography variant="h1">{m.admin_nav_group_access()}</Typography>
		<nav>
			{#each tabs as t (t.href)}
				<a href={localizeHref(t.href)} class:active={isActive(t.href)}>{t.label}</a>
			{/each}
		</nav>
	</header>
	{@render children()}
</div>

<style>
	.access {
		padding: var(--spacing-7);
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-5);
	}
	nav {
		display: flex;
		gap: var(--spacing-4);
	}
	nav a {
		color: var(--color-muted);
		text-decoration: none;
		padding-bottom: var(--spacing-1);
		border-bottom: 2px solid transparent;
	}
	nav a.active {
		color: var(--color-fg);
		border-bottom-color: var(--color-primary);
	}
</style>
