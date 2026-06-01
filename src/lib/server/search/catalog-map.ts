/**
 * Compact, PATH-FREE catalog shape hint for the chatbot system prompt (~120 tok).
 *
 * Surface counts + top breadcrumb group labels only — deliberately NO exact paths.
 * A path-bearing map lets the model answer from the (possibly stale) prompt instead
 * of calling `search_catalog`, and the surface verifier can't catch a path that came
 * from the prompt rather than a tool result. So: counts orient the model; the tool
 * is the only source of links.
 */
import type { SearchLocale, SearchSurface } from '$lib/search/types';
import { buildSearchIndex } from './query';

export function formatCatalogMap(locale: SearchLocale): string {
	const records = buildSearchIndex(locale);
	const counts: Record<SearchSurface, number> = { page: 0, showcase: 0, section: 0, doc: 0, blog: 0 };
	const groups = new Map<string, number>();
	for (const r of records) {
		counts[r.surface]++;
		const key = r.breadcrumb.slice(0, 2).join('›');
		if (key) groups.set(key, (groups.get(key) ?? 0) + 1);
	}
	const topGroups = [...groups.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8)
		.map(([k]) => k);

	// Blog lives in the DB (not the static index) → searchable but uncounted here.
	return [
		'<catalog-map>',
		`pages ${counts.page} · showcases ${counts.showcase} (components/modules/domains) · sections ${counts.section} · docs ${counts.doc} · blog posts (searchable)`,
		topGroups.length ? `groups: ${topGroups.join(', ')}` : '',
		'Call search_catalog for exact paths; never invent one.',
		'</catalog-map>',
	]
		.filter(Boolean)
		.join('\n');
}
