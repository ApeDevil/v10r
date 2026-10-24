/**
 * Prerendered Lane-A search index, one shard per locale.
 *
 * Built at deploy time (titles only — page/showcase/section/doc), served as a
 * static CDN asset, and lazy-fetched on first palette open. Locale-bare paths;
 * the client localizes hrefs at render. Full bodies + live blog come from the
 * separate debounced `GET /api/search`.
 */
import { isLocale, locales } from '#lib/i18n/index.ts';
import { buildSearchIndex } from '#lib/server/search/index.ts';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => locales.map((locale) => ({ locale }));

export const GET: RequestHandler = ({ params }) => {
	if (!isLocale(params.locale)) return Response.json([], { status: 404 });
	return Response.json(buildSearchIndex(params.locale));
};
