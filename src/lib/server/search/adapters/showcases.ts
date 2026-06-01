/**
 * Showcase adapter — turns the showcase card tree + curated in-page sections
 * into `showcase` and `section` records.
 *
 * Showcase labels are English-only, so for de/ru these are `localeFallback`
 * records (rendered with an "EN" badge). Sections deep-link to `#anchor`.
 */

import type { SearchLocale, SearchRecord } from '$lib/search/types';
import { type ShowcaseSublink, showcases } from '$lib/showcases/registry';
import { showcaseSections } from '$lib/showcases/sections';
import { REDIRECT_HREFS } from './_redirects';

function cardTitleFor(pageHref: string): string {
	let best = '';
	let bestLen = -1;
	for (const card of showcases) {
		if (pageHref.startsWith(card.href) && card.href.length > bestLen) {
			best = card.title;
			bestLen = card.href.length;
		}
	}
	return best || 'Showcases';
}

export function showcaseRecords(locale: SearchLocale): SearchRecord[] {
	const fallback = locale !== 'en';
	const out: SearchRecord[] = [];
	const seen = new Set<string>();

	const pushPage = (href: string, title: string, icon: string, breadcrumb: string[]) => {
		if (REDIRECT_HREFS.has(href) || seen.has(href)) return;
		seen.add(href);
		out.push({
			id: `showcase:${locale}:${href}`,
			surface: 'showcase',
			locale,
			localeFallback: fallback,
			title,
			path: href,
			anchor: null,
			breadcrumb,
			icon,
			authScope: 'public',
		});
	};

	const walk = (subs: ShowcaseSublink[], icon: string, trail: string[]) => {
		for (const sub of subs) {
			pushPage(sub.href, sub.label, icon, trail);
			if (sub.children) walk(sub.children, icon, [...trail, sub.label]);
		}
	};

	for (const card of showcases) {
		pushPage(card.href, card.title, card.icon, ['Showcases']);
		if (card.sublinks) walk(card.sublinks, card.icon, [card.title]);
	}

	// In-page sections (deep-linkable showcase "elements").
	for (const section of showcaseSections) {
		const owner = cardTitleFor(section.pageHref);
		out.push({
			id: `section:${locale}:${section.pageHref}#${section.anchorId}`,
			surface: 'section',
			locale,
			localeFallback: fallback,
			title: section.title,
			path: section.pageHref,
			anchor: `#${section.anchorId}`,
			breadcrumb: ['Showcases', owner],
			keywords: section.keywords,
			icon: 'i-lucide-component',
			authScope: 'public',
		});
	}

	return out;
}
