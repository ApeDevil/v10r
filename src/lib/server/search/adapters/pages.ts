/**
 * Page adapter — turns the nav registry into searchable `page` records.
 *
 * Nav labels are genuinely localized (Paraglide), so these are NOT fallback
 * records. Only PUBLIC pages are indexed: `/account/*` and `/admin/*` are excluded
 * so anonymous search never reveals their existence (fixes a prior leak where
 * the old `searchPages` exposed them to everyone).
 */
import { navItems } from '$lib/nav';
import * as m from '$lib/paraglide/messages';
import type { SearchLocale, SearchRecord } from '$lib/search/types';
import { REDIRECT_HREFS } from './_redirects';

function isPublic(href: string): boolean {
	return !href.startsWith('/account') && !href.startsWith('/admin');
}

export function pageRecords(locale: SearchLocale): SearchRecord[] {
	const out: SearchRecord[] = [];
	const seen = new Set<string>();

	const push = (href: string, title: string, icon: string, breadcrumb: string[]) => {
		if (REDIRECT_HREFS.has(href) || seen.has(href) || !isPublic(href)) return;
		seen.add(href);
		out.push({
			id: `page:${locale}:${href}`,
			surface: 'page',
			locale,
			localeFallback: false,
			title,
			path: href,
			anchor: null,
			breadcrumb,
			icon,
			authScope: 'public',
		});
	};

	for (const item of navItems) {
		push(item.href, item.label(), item.icon, []);
		if (item.children) {
			for (const child of item.children) push(child.href, child.label(), item.icon, [item.label()]);
		}
	}

	// Public pages not in the nav registry.
	push('/auth/login', m.nav_log_in(), 'i-lucide-key', []);

	return out;
}
