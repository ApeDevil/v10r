import { type ShowcaseSublink, showcases } from '../../routes/(shell)/showcases/showcases';
import { navItems } from './nav';

export interface SearchPageDescriptor {
	id: string;
	label: string;
	icon: string;
	href: string;
	hint?: string;
}

/** Hrefs that redirect and should not appear in search results. */
const REDIRECT_HREFS = new Set([
	'/app',
	'/showcases/shell',
	'/showcases/ui',
	'/showcases/forms',
	'/showcases/viz',
	'/showcases/db',
	'/showcases/auth',
	'/showcases/ai',
	'/showcases/3d',
	'/showcases/forms/basics',
	'/showcases/forms/validation',
	'/showcases/forms/patterns',
	'/showcases/forms/advanced',
	'/showcases/db/relational',
	'/showcases/db/graph',
	'/showcases/db/storage',
	'/showcases/db/cache',
	'/showcases/ai/retrieval',
	'/showcases/ui/components',
	'/showcases/ui/splits',
	'/showcases/ui/decorative',
]);

function walkSublinks(
	subs: ShowcaseSublink[],
	icon: string,
	breadcrumbs: string[],
	out: SearchPageDescriptor[],
	seen: Set<string>,
) {
	for (const sub of subs) {
		if (!REDIRECT_HREFS.has(sub.href) && !seen.has(sub.href)) {
			seen.add(sub.href);
			out.push({
				id: `page-${sub.href}`,
				label: sub.label,
				icon,
				href: sub.href,
				hint: breadcrumbs.length > 0 ? breadcrumbs.join(' / ') : undefined,
			});
		}
		if (sub.children) {
			walkSublinks(sub.children, icon, [...breadcrumbs, sub.label], out, seen);
		}
	}
}

function buildSearchPages(): SearchPageDescriptor[] {
	const pages: SearchPageDescriptor[] = [];
	const seen = new Set<string>();

	// 1. Flatten navItems (top-level + children)
	for (const item of navItems) {
		if (!REDIRECT_HREFS.has(item.href) && !seen.has(item.href)) {
			seen.add(item.href);
			pages.push({
				id: `page-${item.href}`,
				label: item.label,
				icon: item.icon,
				href: item.href,
			});
		}
		if (item.children) {
			for (const child of item.children) {
				if (!REDIRECT_HREFS.has(child.href) && !seen.has(child.href)) {
					seen.add(child.href);
					pages.push({
						id: `page-${child.href}`,
						label: child.label,
						icon: item.icon,
						href: child.href,
						hint: item.label,
					});
				}
			}
		}
	}

	// 2. Walk showcases tree recursively
	for (const card of showcases) {
		if (!REDIRECT_HREFS.has(card.href) && !seen.has(card.href)) {
			seen.add(card.href);
			pages.push({
				id: `page-${card.href}`,
				label: card.title,
				icon: card.icon,
				href: card.href,
			});
		}
		if (card.sublinks) {
			walkSublinks(card.sublinks, card.icon, [card.title], pages, seen);
		}
	}

	// 3. Manual entries for non-registry pages
	const manual: Omit<SearchPageDescriptor, 'id'>[] = [
		{ label: 'Log In', icon: 'i-lucide-key', href: '/auth/login' },
		{ label: 'Jobs', icon: 'i-lucide-clock', href: '/showcases/jobs' },
		{ label: 'Notification Settings', icon: 'i-lucide-bell', href: '/app/notifications/settings' },
	];
	for (const entry of manual) {
		if (!seen.has(entry.href)) {
			seen.add(entry.href);
			pages.push({ id: `page-${entry.href}`, ...entry });
		}
	}

	return pages;
}

export const searchPages: SearchPageDescriptor[] = buildSearchPages();
