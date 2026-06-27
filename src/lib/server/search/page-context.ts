/**
 * Site-awareness — server-side route resolution (the trust boundary).
 *
 * Turns a client-sent `page.route.id` into the server's OWN trusted description of the page,
 * keyed by catalog membership. The client string is a lookup key, discarded on miss and never
 * echoed: only `buildSearchIndex` records (public-only — the pages adapter excludes `/app` and
 * `/admin`) can produce a `PageContext`. This is the positive allowlist that fails safe —
 * admin/app/auth routes simply aren't in the index. See `docs/blueprint/ai/site-awareness.md`.
 */
import { normalizeRouteId } from '$lib/search/route-id';
import type { SearchLocale, SearchRecord } from '$lib/search/types';
import { buildSearchIndex } from './query';

export interface PageContext {
	/** Server-resolved canonical public path (never the raw client string). */
	path: string;
	title: string;
	breadcrumb: string[];
	/** SearchSurface (`page` | `showcase` | `doc` | …) — used as the block's `kind` hint. */
	surface: string;
}

/** Per-locale memoized path → page-level record map. `buildSearchIndex` is a touch expensive
 *  (pins the Paraglide locale), so we build the lookup once per locale per process. */
const indexCache = new Map<SearchLocale, Map<string, SearchRecord>>();

function pathIndex(locale: SearchLocale): Map<string, SearchRecord> {
	let map = indexCache.get(locale);
	if (!map) {
		map = new Map();
		for (const rec of buildSearchIndex(locale)) {
			if (rec.anchor !== null) continue; // page-level only — skip section/heading anchors
			if (rec.authScope !== 'public') continue; // belt-and-suspenders; the index is already public
			if (!map.has(rec.path)) map.set(rec.path, rec);
		}
		indexCache.set(locale, map);
	}
	return map;
}

/**
 * Resolve a client `page.route.id` to trusted page metadata, or `null` (unknown route, dynamic
 * `[param]` route, or anything not in the public catalog). On `null` the caller injects nothing,
 * seeds nothing, and stores nothing.
 */
export function resolvePageContext(routeId: string | null | undefined, locale: SearchLocale): PageContext | null {
	const path = normalizeRouteId(routeId);
	if (!path) return null;
	const rec = pathIndex(locale).get(path);
	if (!rec) return null;
	return { path: rec.path, title: rec.title, breadcrumb: rec.breadcrumb, surface: rec.surface };
}
