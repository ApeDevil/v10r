import { DOCS_SECTIONS } from '$lib/docs/sections';
import * as m from '$lib/paraglide/messages';
import { groupByDomain } from '$lib/showcases/catalog/registry';
import { adminNavGroups } from './admin';
import type { LabelFn, NavChild, NavItem } from './types';

/** The admin sidebar group a curated dropdown entry belongs to (a hub href matches its section's pages). */
function adminGroupOf(href: string): LabelFn | undefined {
	return adminNavGroups.find((group) =>
		group.items.some((item) => item.href === href || item.href.startsWith(`${href}/`)),
	)?.label;
}

function adminChild(href: string, label: LabelFn): NavChild {
	return { href, label, group: adminGroupOf(href) };
}

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
	// A curated hub-level subset (admin.ts is the full registry) — the group
	// labels are the sidebar's, so the dropdown reads as the same six directions.
	children: [
		adminChild('/admin/db', m.nav_admin_db),
		adminChild('/admin/analytics', m.nav_admin_analytics),
		adminChild('/admin/perf', m.nav_admin_perf),
		adminChild('/admin/audit', m.nav_admin_audit),
		adminChild('/admin/users', m.nav_admin_users),
		adminChild('/admin/flags', m.nav_admin_flags),
		adminChild('/admin/ai', m.nav_admin_ai),
		adminChild('/admin/jobs', m.nav_admin_jobs),
		adminChild('/admin/notifications', m.nav_admin_notifications),
		adminChild('/admin/cache', m.nav_admin_cache),
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
		// Derived from the showcase registry, in the hub's domain order, so the
		// dropdown can never drift from the hub — five directions, not 25 rows.
		children: groupByDomain().flatMap(({ domain, cards }) =>
			cards.map((card) => ({ href: card.href, label: card.title, group: domain.label })),
		),
	},
	{
		href: '/docs',
		label: m.nav_docs,
		icon: 'i-lucide-book-open',
		// The hub's five sections, from the list the hub itself renders.
		children: DOCS_SECTIONS.map((section) => ({ href: section.href, label: section.title })),
	},
];
