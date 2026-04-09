<script lang="ts">
import { page } from '$app/state';
import { deLocalizeHref, localizeHref } from '$lib/i18n';

interface AdminNavItem {
	label: string;
	href: string;
	icon: string;
}

interface AdminNavGroup {
	label: string;
	items: AdminNavItem[];
}

interface Props {
	groups: AdminNavGroup[];
	class?: string;
}

let { groups, class: className }: Props = $props();

function isActive(href: string): boolean {
	return deLocalizeHref(page.url.pathname).startsWith(href);
}
</script>

<nav class="admin-sidebar {className ?? ''}" aria-label="Admin navigation">
	{#each groups as group, gi}
		{#if gi > 0}
			<div class="group-divider" aria-hidden="true"></div>
		{/if}
		<div class="group">
			<span class="group-label">{group.label}</span>
			<ul>
				{#each group.items as item}
					<li>
						<a
							href={localizeHref(item.href)}
							class="nav-link"
							class:active={isActive(item.href)}
							aria-current={isActive(item.href) ? 'page' : undefined}
						>
							<span class="{item.icon} nav-icon" aria-hidden="true"></span>
							<span class="nav-label">{item.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/each}
</nav>

<style>
	.admin-sidebar {
		width: 200px;
		flex-shrink: 0;
		position: sticky;
		top: 0;
		height: 100dvh;
		overflow-y: auto;
		padding: var(--spacing-5) var(--spacing-3);
		border-right: 1px solid var(--color-border);
		scrollbar-width: thin;
		scrollbar-color: var(--color-border) transparent;
	}

	.admin-sidebar::-webkit-scrollbar {
		width: 6px;
	}

	.admin-sidebar::-webkit-scrollbar-track {
		background: transparent;
	}

	.admin-sidebar::-webkit-scrollbar-thumb {
		background: var(--color-border);
		border-radius: 3px;
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.group-label {
		padding: var(--spacing-1) var(--spacing-3);
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		user-select: none;
	}

	.group-divider {
		height: 1px;
		margin: var(--spacing-3) var(--spacing-3);
		background: var(--color-border);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.nav-link {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-2) var(--spacing-3);
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-muted);
		text-decoration: none;
		border-radius: var(--radius-md);
		border-left: 2px solid transparent;
		transition: color 150ms ease, background-color 150ms ease;
	}

	.nav-link:hover {
		color: var(--color-fg);
		background-color: color-mix(in srgb, var(--color-fg) 6%, transparent);
	}

	.nav-link.active {
		color: var(--color-primary);
		border-left-color: var(--color-primary);
		background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
	}

	.nav-link:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.nav-icon {
		font-size: 1rem;
		flex-shrink: 0;
	}

	.nav-label {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
