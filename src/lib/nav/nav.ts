import type { NavItem } from './types';

/**
 * Navigation registry — the single source of truth for sidebar nav.
 *
 * Rules:
 *   - Array order = display order
 *   - Only routes with +page.svelte get listed
 *   - Deep routes (level 3+) are reached via hub page cards, not here
 *   - Adding a route? Add one entry to the appropriate children[]
 */
export const adminNavItem: NavItem = {
	href: '/admin',
	label: 'Admin',
	icon: 'i-lucide-shield',
	children: [
		{ href: '/admin/db', label: 'DB Observation' },
		{ href: '/admin/branding', label: 'Branding' },
		{ href: '/admin/jobs', label: 'Jobs' },
	],
};

export const navItems: NavItem[] = [
	{
		href: '/',
		label: 'Home',
		icon: 'i-lucide-home',
	},
	{
		href: '/desk',
		label: 'Desk',
		icon: 'i-lucide-panel-top',
	},
	{
		href: '/app',
		label: 'App',
		icon: 'i-lucide-layout-dashboard',
		children: [
			{ href: '/app/dashboard', label: 'Dashboard' },
			{ href: '/app/account', label: 'Account' },
			{ href: '/app/settings', label: 'Settings' },
			{ href: '/app/notifications', label: 'Notifications' },
		],
	},
	{
		href: '/showcases',
		label: 'Showcases',
		icon: 'i-lucide-view',
		children: [
			{ href: '/showcases/shell', label: 'Shell' },
			{ href: '/showcases/ui', label: 'UI' },
			{ href: '/showcases/forms', label: 'Forms' },
			{ href: '/showcases/viz', label: 'Viz' },
			{ href: '/showcases/3d', label: '3D' },
			{ href: '/showcases/db', label: 'DB' },
			{ href: '/showcases/auth', label: 'Auth' },
			{ href: '/showcases/ai', label: 'AI' },
			{ href: '/showcases/i18n', label: 'i18n' },
		],
	},
	{
		href: '/docs',
		label: 'Docs',
		icon: 'i-lucide-book-open',
		children: [{ href: '/docs/stack', label: 'Stack' }],
	},
];
