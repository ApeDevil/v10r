<script lang="ts">
import { page } from '$app/state';
import { Typography } from '$lib/components/primitives';

let { children, data } = $props();

const tabs = [
	{ href: '/admin/access/authors', label: 'Authors' },
	{ href: '/admin/access/requests', label: `Requests (${data.pendingRequestsCount})` },
];

const isActive = (href: string) => page.url.pathname.startsWith(href);
</script>

<div class="access">
	<header>
		<Typography variant="h1">Access</Typography>
		<nav>
			{#each tabs as t (t.href)}
				<a href={t.href} class:active={isActive(t.href)}>{t.label}</a>
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
