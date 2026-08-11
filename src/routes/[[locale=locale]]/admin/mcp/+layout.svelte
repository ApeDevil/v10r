<script lang="ts">
import type { Snippet } from 'svelte';
import { afterNavigate } from '$app/navigation';
import { page } from '$app/state';
import { Typography } from '$lib/components/primitives';
import { deLocalizeHref, localizeHref } from '$lib/i18n';

let { children }: { children: Snippet } = $props();

const tabs = [
	{ href: '/admin/mcp', label: 'Demo' },
	{ href: '/admin/mcp/usage', label: 'Usage' },
];

/**
 * The Demo tab needs an EXACT match, not a prefix match.
 *
 * `/admin/mcp` is a prefix of `/admin/mcp/usage`, so the usual `startsWith` form — correct in every
 * other admin section, where no tab href is a prefix of another — would light up BOTH tabs on the
 * usage page and emit two `aria-current="page"`. That is the direct cost of keeping the demo view
 * at the section root instead of redirecting it to a child, which is worth it: `/admin/mcp` is
 * named in four strings that ship to clients on the admin MCP wire.
 */
const isActive = (href: string) => {
	const path = deLocalizeHref(page.url.pathname);
	return href === '/admin/mcp' ? path === '/admin/mcp' : path.startsWith(href);
};
const activeTab = $derived(tabs.find((t) => isActive(t.href)));

// Move focus on real tab changes (not initial hydration) for keyboard/SR users.
let contentEl = $state<HTMLDivElement>();
afterNavigate(({ type }) => {
	if (type !== 'enter') contentEl?.focus();
});
</script>

<section class="mcp-section">
	<header class="mcp-header">
		<Typography variant="h1">MCP</Typography>
		<nav class="mcp-tabs" aria-label="MCP sections">
			{#each tabs as t (t.href)}
				<a
					href={localizeHref(t.href)}
					class:active={isActive(t.href)}
					aria-current={isActive(t.href) ? 'page' : undefined}>{t.label}</a
				>
			{/each}
		</nav>
	</header>

	<div
		class="mcp-content"
		tabindex="-1"
		bind:this={contentEl}
		aria-label={activeTab ? `${activeTab.label} panel` : 'MCP panel'}
	>
		{@render children()}
	</div>
</section>

<style>
.mcp-header {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: var(--spacing-3);
	margin-bottom: var(--spacing-5);
}
.mcp-tabs {
	display: flex;
	gap: var(--spacing-4);
	overflow-x: auto;
	scrollbar-width: thin;
	max-width: 100%;
}
.mcp-tabs a {
	color: var(--color-muted);
	text-decoration: none;
	padding-bottom: var(--spacing-1);
	border-bottom: 2px solid transparent;
	white-space: nowrap;
}
.mcp-tabs a:hover {
	color: var(--color-fg);
}
.mcp-tabs a.active {
	color: var(--color-fg);
	border-bottom-color: var(--color-primary);
}
.mcp-tabs a:focus-visible {
	outline: 2px solid var(--color-primary);
	outline-offset: 2px;
	border-radius: var(--radius-sm);
}
.mcp-content:focus {
	outline: none;
}
</style>
