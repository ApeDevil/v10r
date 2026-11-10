/**
 * Compact, PATH-FREE map of the site for the chatbot system prompt.
 *
 * The site's top-level sections in nav order, each with what it is for and the pages under
 * it (by their group: a showcase domain, a workflow category, a Studio area), plus the
 * surface counts. Deliberately NO exact paths: a path-bearing map lets the model answer
 * from the prompt instead of calling `search_catalog`, and the surface verifier can't catch
 * a path that came from the prompt rather than a tool result. So: the outline routes the
 * question to the right section; the tool is the only source of links.
 *
 * Built from the nav registry the catalog's page records come from (hub pages that only
 * redirect included, since they name the group), so a section, showcase, workflow or Studio
 * area added to its registry appears here without an edit. Only the one-line purpose of each
 * top-level section is written by hand (`SECTION_PURPOSE`).
 */
import type { Locale } from '#lib/i18n/index.ts';
import { type NavItem, navItems } from '#lib/nav/index.ts';
import { getLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import type { SearchSurface } from '#lib/search/types.ts';
import { buildSearchIndex } from './query';

/**
 * What each top-level nav section is for, keyed by its href. Model-facing English: the
 * chatbot answers in the reader's language. Every nav item needs one (catalog-map.test.ts).
 */
export const SECTION_PURPOSE: Readonly<Record<string, string>> = {
	'/': 'the landing page: what Velociraptor (v10r) is, a full-stack SvelteKit pattern library whose proven patterns an AI agent reads and adapts to a new project (emulation, not cloning), and its capability taxonomy',
	'/showcases':
		'live, working demos of the patterns, one per feature, grouped by domain; each links to the docs behind it',
	'/workflows':
		'step-by-step tutorials for everyday office work with any AI tool, written for people who do not code: no git, no repository, nothing to install, each with a downloadable example folder',
	'/studio':
		'interactive tools for engineering a system before building it; each area has an overview and working modes',
	'/docs': 'the documentation behind every pattern, for developers',
	'/blog': 'articles about the project',
};

/** One section line: purpose, then its pages grouped as the nav groups them. */
function sectionLine(item: NavItem): string {
	const groups = new Map<string, string[]>();
	for (const child of item.children ?? []) {
		const group = child.group?.() ?? '';
		groups.set(group, [...(groups.get(group) ?? []), child.label()]);
	}
	const listed = [...groups.entries()]
		.map(([group, titles]) => (group ? `${group}: ${titles.join(' · ')}` : titles.join(' · ')))
		.join('; ');
	return `- ${item.label()}: ${SECTION_PURPOSE[item.href]}.${listed ? ` ${listed}` : ''}`;
}

/** The section lines in one locale (labels resolved with the Paraglide locale pinned). */
function sectionLines(locale: Locale): string[] {
	const original = getLocale;
	overwriteGetLocale(() => locale);
	try {
		return navItems.filter((item) => SECTION_PURPOSE[item.href]).map(sectionLine);
	} finally {
		overwriteGetLocale(original);
	}
}

const mapCache = new Map<Locale, string>();

/** The map for one locale; static per process, so memoized like the index it describes. */
export function formatCatalogMap(locale: Locale): string {
	const cached = mapCache.get(locale);
	if (cached) return cached;
	const records = buildSearchIndex(locale);
	const counts: Record<SearchSurface, number> = { page: 0, showcase: 0, section: 0, doc: 0, blog: 0 };
	for (const r of records) counts[r.surface]++;

	// Blog lives in the DB (not the static index) → searchable but uncounted here.
	const map = [
		'<catalog-map>',
		'The site, by top-level section:',
		...sectionLines(locale),
		`Catalog: pages ${counts.page} · showcases ${counts.showcase} (components/modules/domains) · sections ${counts.section} · docs ${counts.doc} · blog posts (searchable)`,
		'Call search_catalog for exact paths; never invent one.',
		'</catalog-map>',
	].join('\n');
	mapCache.set(locale, map);
	return map;
}
