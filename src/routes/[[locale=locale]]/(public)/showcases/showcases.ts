/**
 * Showcase route navigation helpers.
 *
 * The card tree itself lives in `$lib/showcases/registry` (so non-route
 * consumers like the search adapters can read it without a `$lib → routes`
 * back-edge). This module re-exports it and adds the route-only helpers that
 * resolve the registry's Paraglide label functions into plain strings for
 * `ShowcaseLayout` / `NavTab` / `PageHeader`.
 */
import * as m from '$lib/paraglide/messages';
import { groupByDomain, type ShowcaseCard, type ShowcaseSublink, showcases } from '$lib/showcases/registry';

export { groupByDomain, type ShowcaseCard, type ShowcaseSublink, showcases };

/** The card owning `basePath`. Throws on unknown paths — fail loud at dev/SSR time. */
export function getShowcaseCard(basePath: string): ShowcaseCard {
	const card = showcases.find((s) => s.href === basePath);
	if (!card) throw new Error(`Unknown showcase card: ${basePath}`);
	return card;
}

/** Home → Showcases → card trail (labels resolved) for PageHeader consumers. */
export function showcaseBreadcrumbs(card: ShowcaseCard): { label: string; href?: string }[] {
	return [
		{ label: m.showcase_breadcrumb_home(), href: '/' },
		{ label: m.showcase_breadcrumb_showcases(), href: '/showcases' },
		{ label: (card.breadcrumbLabel ?? card.title)() },
	];
}

export function getShowcaseTabs(basePath: string): { label: string; href: string }[] {
	const sublinks = showcases.find((s) => s.href === basePath)?.sublinks ?? [];
	return sublinks.map((s) => ({ label: s.label(), href: s.href }));
}

export function getShowcaseSubTabs(parentPath: string): { label: string; href: string }[] {
	for (const card of showcases) {
		if (!card.sublinks) continue;
		for (const sub of card.sublinks) {
			if (sub.href === parentPath && sub.children) {
				return sub.children.map((c) => ({ label: c.label(), href: c.href }));
			}
		}
	}
	return [];
}

/** Resolved label of the sublink at `parentPath` — feeds `showcase_subtabs_aria`. */
export function getShowcaseSublinkLabel(parentPath: string): string {
	for (const card of showcases) {
		for (const sub of card.sublinks ?? []) {
			if (sub.href === parentPath) return sub.label();
		}
	}
	return '';
}
