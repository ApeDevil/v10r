<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { deLocalizeHref } from '$lib/i18n';
	import { AdminSidebar } from '$lib/components/shell';
	import { PageContainer } from '$lib/components/layout';

	let { children }: { children: Snippet } = $props();

	let mobileNavOpen = $state(false);

	const groups = [
		{
			label: 'Observe',
			items: [
				{ label: 'DB Observation', href: '/admin/db', icon: 'i-lucide-database' },
				{ label: 'Analytics', href: '/admin/analytics', icon: 'i-lucide-bar-chart-2' },
				{ label: 'Audit Log', href: '/admin/audit', icon: 'i-lucide-shield-check' },
			],
		},
		{
			label: 'Manage',
			items: [
				{ label: 'Users', href: '/admin/users', icon: 'i-lucide-users' },
				{ label: 'Feature Flags', href: '/admin/flags', icon: 'i-lucide-toggle-right' },
				{ label: 'Branding', href: '/admin/branding', icon: 'i-lucide-palette' },
			],
		},
		{
			label: 'Content',
			items: [
				{ label: 'Posts', href: '/admin/content/posts', icon: 'i-lucide-file-text' },
				{ label: 'Tags', href: '/admin/content/tags', icon: 'i-lucide-tag' },
			],
		},
		{
			label: 'System',
			items: [
				{ label: 'Jobs', href: '/admin/jobs', icon: 'i-lucide-clock' },
				{ label: 'Notifications', href: '/admin/notifications', icon: 'i-lucide-bell' },
				{ label: 'AI Usage', href: '/admin/ai', icon: 'i-lucide-bot' },
				{ label: 'RAG', href: '/admin/rag', icon: 'i-lucide-book-open' },
				{ label: 'Cache', href: '/admin/cache', icon: 'i-lucide-hard-drive' },
			],
		},
	];

	const allItems = groups.flatMap((g) => g.items);

	const currentPage = $derived(
		allItems.find((item) => deLocalizeHref(page.url.pathname).startsWith(item.href)) ?? allItems[0],
	);

	// Close mobile nav on navigation
	$effect(() => {
		page.url.pathname;
		mobileNavOpen = false;
	});
</script>

<div class="admin-layout">
	<!-- Desktop sidebar -->
	<div class="admin-desktop-sidebar">
		<AdminSidebar {groups} />
	</div>

	<!-- Mobile nav -->
	<div class="admin-mobile-nav">
		<button
			type="button"
			class="mobile-nav-trigger"
			onclick={() => (mobileNavOpen = !mobileNavOpen)}
			aria-expanded={mobileNavOpen}
			aria-controls="admin-mobile-menu"
		>
			<span class="{currentPage.icon} mobile-trigger-icon" aria-hidden="true"></span>
			<span>{currentPage.label}</span>
			<span class="i-lucide-chevron-down mobile-chevron" class:open={mobileNavOpen} aria-hidden="true"></span>
		</button>

		{#if mobileNavOpen}
			<div id="admin-mobile-menu" class="mobile-menu">
				<AdminSidebar {groups} class="mobile-sidebar" />
			</div>
		{/if}
	</div>

	<!-- Content -->
	<div class="admin-content">
		<PageContainer class="py-7">
			{@render children()}
		</PageContainer>
	</div>
</div>

<style>
	.admin-layout {
		display: flex;
		min-height: 0;
	}

	/* Desktop sidebar: hidden on mobile */
	.admin-desktop-sidebar {
		display: none;
	}

	/* Mobile nav: visible on mobile only */
	.admin-mobile-nav {
		position: relative;
		padding: var(--spacing-3) var(--spacing-4);
		border-bottom: 1px solid var(--color-border);
	}

	.mobile-nav-trigger {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		width: 100%;
		padding: var(--spacing-2) var(--spacing-3);
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		cursor: pointer;
	}

	.mobile-nav-trigger:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.mobile-trigger-icon {
		font-size: 1rem;
		color: var(--color-primary);
	}

	.mobile-chevron {
		margin-left: auto;
		font-size: 0.875rem;
		color: var(--color-muted);
		transition: transform 150ms ease;
	}

	.mobile-chevron.open {
		transform: rotate(180deg);
	}

	.mobile-menu {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 10;
		background: var(--color-bg);
		border-bottom: 1px solid var(--color-border);
		box-shadow: 0 4px 12px color-mix(in srgb, var(--color-fg) 8%, transparent);
	}

	/* Override sidebar styles when used in mobile dropdown */
	.mobile-menu :global(.mobile-sidebar) {
		width: 100%;
		position: static;
		height: auto;
		border-right: none;
		padding: var(--spacing-3) var(--spacing-4);
	}

	.admin-content {
		flex: 1;
		min-width: 0;
	}

	@media (min-width: 768px) {
		.admin-layout {
			flex-direction: row;
		}

		.admin-desktop-sidebar {
			display: block;
		}

		.admin-mobile-nav {
			display: none;
		}
	}

	/* Mobile: stack vertically */
	@media (max-width: 767px) {
		.admin-layout {
			flex-direction: column;
		}
	}
</style>
