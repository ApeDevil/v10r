import type { Locale } from '$lib/i18n';
import { match } from '$lib/search/match';
import type { SearchResult } from '$lib/search/types';
import { buildSearchIndex, searchContent } from '$lib/server/search';
import type { PageServerLoad } from './$types';

const key = (r: SearchResult) => `${r.surface}:${r.path}:${r.anchor ?? ''}`;

export const load: PageServerLoad = async ({ url, locals }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	const locale = (locals.locale ?? 'en') as Locale;

	if (!q) return { q: '', results: [] as SearchResult[] };

	// Full results = client static lane (pages/showcases/sections/doc titles,
	// matched server-side here for SSR) + server lane (full-body docs + live blog).
	const [serverHits, staticHits] = await Promise.all([
		searchContent(q, { locale, limit: 50, scope: 'all' }),
		Promise.resolve(match(buildSearchIndex(locale), q, 50)),
	]);

	const byDest = new Map<string, SearchResult>();
	for (const r of staticHits) byDest.set(key(r), r);
	for (const r of serverHits) byDest.set(key(r), r); // server (richer snippet) wins

	const results = Array.from(byDest.values()).sort((a, b) => b.score - a.score);
	return { q, results };
};
