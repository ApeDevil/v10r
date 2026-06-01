/**
 * Universal search — shared, client-safe types.
 *
 * `SearchRecord` is an indexed item (used by the Lane-A static shard and the
 * server-side corpus). `SearchResult` is a ranked hit returned to the palette,
 * the `/search` page, and `GET /api/search`. Both surfaces consume the identical
 * `SearchResult` shape so there is never a shape mismatch between clients.
 *
 * Locale model: docs/showcases are English-only today and surface to de/ru users
 * as `localeFallback: true` (rendered with an "EN" badge). The whole layer is
 * locale-parameterized so authoring native de/ru content later needs no rework.
 */
export type SearchSurface = 'page' | 'showcase' | 'section' | 'doc' | 'blog';

export type SearchLocale = 'en' | 'de' | 'ru';

export interface SearchRecord {
	/** Stable id: `${surface}:${locale}:${path}${anchor ?? ''}`. */
	id: string;
	surface: SearchSurface;
	locale: SearchLocale;
	/** EN content shown to a de/ru user → drives the "EN" badge + a small rank penalty. */
	localeFallback: boolean;
	title: string;
	/** Locale-bare path (e.g. `/docs/stack/svelte`). Localized at render via `localizeHref`. */
	path: string;
	/** `#heading-id` for doc headings / showcase sections; null otherwise. */
	anchor: string | null;
	/** Trail for orientation, e.g. `['Docs', 'Stack']`. */
	breadcrumb: string[];
	/** CSS icon class, e.g. `i-lucide-book-open`. */
	icon?: string;
	/** Curated (showcase sections) or extracted (doc headings) terms. */
	keywords?: string[];
	/** Full body text — server corpus only; never shipped in the Lane-A shard. */
	body?: string;
	authScope: 'public' | 'user' | 'admin';
}

export interface SearchResult {
	id: string;
	surface: SearchSurface;
	title: string;
	/** CSS icon class; falls back to a per-surface icon if absent. */
	icon?: string;
	/** Locale-bare; localized at render. */
	path: string;
	anchor: string | null;
	breadcrumb: string[];
	/** Plain-text excerpt, HTML-free. Null for title-only hits. */
	snippet: string | null;
	/** Character ranges into `snippet` to wrap in `<mark>`. */
	highlight: [number, number][];
	locale: string;
	badge: 'en-fallback' | null;
	/** Normalized relevance within this lane; clients render in order, never re-sort. */
	score: number;
}

/** Display order when group-stacking results (palette + `/search`). */
export const SURFACE_ORDER: SearchSurface[] = ['page', 'showcase', 'section', 'doc', 'blog'];
