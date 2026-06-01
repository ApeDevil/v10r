/**
 * Showcase route navigation helpers.
 *
 * The card tree itself lives in `$lib/showcases/registry` (so non-route
 * consumers like the search adapters can read it without a `$lib → routes`
 * back-edge). This module re-exports it and adds the route-only tab helpers.
 */
import { type ShowcaseCard, type ShowcaseSublink, showcases } from '$lib/showcases/registry';

export { type ShowcaseCard, type ShowcaseSublink, showcases };

export function getShowcaseTabs(basePath: string) {
	return showcases.find((s) => s.href === basePath)?.sublinks ?? [];
}

export function getShowcaseSubTabs(parentPath: string): { label: string; href: string }[] {
	for (const card of showcases) {
		if (!card.sublinks) continue;
		for (const sub of card.sublinks) {
			if (sub.href === parentPath && sub.children) {
				return sub.children.map((c) => ({ label: c.label, href: c.href }));
			}
		}
	}
	return [];
}
