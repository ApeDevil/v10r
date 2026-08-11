import * as m from '$lib/paraglide/messages';
import type { LabelFn } from './types';

/**
 * Admin navigation registry — the single source of truth for the admin
 * sidebar AND the AI section tabs. Both surfaces previously carried their own
 * inline arrays (hand-synced, in English only), which is how three real pages
 * (/admin/access/*, /admin/content/comments) ended up reachable by direct URL
 * only.
 *
 * Rules:
 *   - Array order = display order
 *   - Every admin +page.svelte belongs to exactly one group (redirect-only
 *     hubs like /admin and /admin/db excluded; detail routes like
 *     /admin/feedback/[id] are reached from their list page)
 *   - `label` is a Paraglide message function; consumers call it at render time
 *
 * The top-nav dropdown (`nav.ts` adminNavItem) stays a deliberately curated
 * hub-level subset — do not mirror this registry into it entry by entry.
 */

export interface AdminNavItem {
	label: LabelFn;
	href: string;
	icon: string;
}

export interface AdminNavGroup {
	label: LabelFn;
	items: AdminNavItem[];
}

export const adminNavGroups: AdminNavGroup[] = [
	{
		label: m.admin_nav_group_observe,
		items: [
			{ label: m.admin_nav_database, href: '/admin/db', icon: 'i-lucide-database' },
			{ label: m.admin_nav_analytics, href: '/admin/analytics', icon: 'i-lucide-bar-chart-2' },
			{ label: m.admin_nav_vitals, href: '/admin/vitals', icon: 'i-lucide-heart-pulse' },
			{ label: m.admin_nav_audit, href: '/admin/audit', icon: 'i-lucide-shield-check' },
		],
	},
	{
		label: m.admin_nav_group_manage,
		items: [
			{ label: m.admin_nav_users, href: '/admin/users', icon: 'i-lucide-users' },
			{ label: m.admin_nav_flags, href: '/admin/flags', icon: 'i-lucide-toggle-right' },
		],
	},
	{
		label: m.admin_nav_group_access,
		items: [
			{ label: m.admin_nav_authors, href: '/admin/access/authors', icon: 'i-lucide-feather' },
			{ label: m.admin_nav_requests, href: '/admin/access/requests', icon: 'i-lucide-inbox' },
		],
	},
	{
		label: m.admin_nav_group_content,
		items: [
			{ label: m.admin_nav_posts, href: '/admin/content/posts', icon: 'i-lucide-file-text' },
			{ label: m.admin_nav_tags, href: '/admin/content/tags', icon: 'i-lucide-tag' },
			{ label: m.admin_nav_comments, href: '/admin/content/comments', icon: 'i-lucide-messages-square' },
			{ label: m.admin_nav_feedback, href: '/admin/feedback', icon: 'i-lucide-message-square' },
		],
	},
	{
		label: m.admin_nav_group_ai,
		items: [
			{ label: m.admin_nav_ai_overview, href: '/admin/ai/overview', icon: 'i-lucide-gauge' },
			{ label: m.admin_nav_ai_models, href: '/admin/ai/models', icon: 'i-lucide-cpu' },
			{ label: m.admin_nav_ai_usage, href: '/admin/ai/usage', icon: 'i-lucide-bar-chart-2' },
			{ label: m.admin_nav_ai_cost, href: '/admin/ai/cost', icon: 'i-lucide-receipt' },
			{ label: m.admin_nav_ai_nrag, href: '/admin/ai/nrag', icon: 'i-lucide-book-marked' },
			{ label: m.admin_nav_ai_tools, href: '/admin/ai/tools', icon: 'i-lucide-wrench' },
		],
	},
	{
		label: m.admin_nav_group_system,
		items: [
			{ label: m.admin_nav_jobs, href: '/admin/jobs', icon: 'i-lucide-clock' },
			{ label: m.admin_nav_notifications, href: '/admin/notifications', icon: 'i-lucide-bell' },
			{ label: m.admin_nav_cache, href: '/admin/cache', icon: 'i-lucide-hard-drive' },
			{ label: m.admin_nav_mcp, href: '/admin/mcp', icon: 'i-lucide-plug-zap' },
			{ label: m.admin_nav_mcp_usage, href: '/admin/mcp/usage', icon: 'i-lucide-activity' },
		],
	},
];

/** The AI section's tab strip — same entries as the sidebar's AI group. */
export const adminAiTabs: AdminNavItem[] = adminNavGroups.find((g) => g.label === m.admin_nav_group_ai)?.items ?? [];
