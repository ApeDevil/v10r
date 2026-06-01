/**
 * Prerendered Lane-A search index, one shard per locale.
 *
 * Built at deploy time (titles only — page/showcase/section/doc), served as a
 * static CDN asset, and lazy-fetched on first palette open. Locale-bare paths;
 * the client localizes hrefs at render. Full bodies + live blog come from the
 * separate debounced `GET /api/search`.
 */
import { json } from '@sveltejs/kit';
import type { SearchLocale } from '$lib/search/types';
import { buildSearchIndex } from '$lib/server/search';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => [{ locale: 'en' }, { locale: 'de' }, { locale: 'ru' }];

const LOCALES = new Set<SearchLocale>(['en', 'de', 'ru']);

export const GET: RequestHandler = ({ params }) => {
	const locale = params.locale as SearchLocale;
	if (!LOCALES.has(locale)) return json([], { status: 404 });
	return json(buildSearchIndex(locale));
};
