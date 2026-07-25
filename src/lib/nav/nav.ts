import * as m from '$lib/paraglide/messages';
import { showcases } from '$lib/showcases/registry';
import type { NavItem } from './types';

/**
 * Navigation registry — the single source of truth for sidebar nav.
 *
 * Rules:
 *   - Array order = display order
 *   - Only routes with +page.svelte get listed
 *   - Deep routes (level 3+) are reached via hub page cards, not here
 *   - Adding a route? Add one entry to the appropriate children[]
 *   - `label` is a Paraglide message function; consumers call `item.label()` at render time
 */
export const adminNavItem: NavItem = {
	href: '/admin',
	label: m.nav_admin,
	icon: 'i-lucide-shield',
	children: [
		{ href: '/admin/db', label: m.nav_admin_db },
		{ href: '/admin/analytics', label: m.nav_admin_analytics },
		{ href: '/admin/audit', label: m.nav_admin_audit },
		{ href: '/admin/users', label: m.nav_admin_users },
		{ href: '/admin/flags', label: m.nav_admin_flags },
		{ href: '/admin/branding', label: m.nav_admin_branding },
		{ href: '/admin/jobs', label: m.nav_admin_jobs },
		{ href: '/admin/notifications', label: m.nav_admin_notifications },
		{ href: '/admin/ai', label: m.nav_admin_ai },
		{ href: '/admin/cache', label: m.nav_admin_cache },
	],
};

export const navItems: NavItem[] = [
	{
		href: '/',
		label: m.nav_home,
		icon: 'i-lucide-home',
	},
	{
		href: '/blog',
		label: m.nav_blog,
		icon: 'i-lucide-newspaper',
	},
	{
		href: '/desk',
		label: m.nav_desk,
		icon: 'i-lucide-panel-top',
	},
	{
		href: '/showcases',
		label: m.nav_showcases,
		icon: 'i-lucide-view',
		// Derived from the showcase registry so the dropdown can never drift from the hub.
		children: showcases.map((card) => ({ href: card.href, label: card.title })),
	},
	{
		href: '/docs',
		label: m.nav_docs,
		icon: 'i-lucide-book-open',
		children: [{ href: '/docs/stack', label: m.nav_docs_stack }],
	},
];
