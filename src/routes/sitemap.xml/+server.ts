import { baseLocale, locales } from '$lib/paraglide/runtime';
import { listPublishedPostsForFeed } from '$lib/server/blog';
import { REDIRECT_HREFS } from '$lib/server/search/adapters/_redirects';
import { showcases } from '$lib/showcases/registry';
import type { RequestHandler } from './$types';

const PROD_ORIGIN = 'https://www.v10r.dev';

/** Non-showcase static public pages. */
const BASE_PATHS = ['/', '/blog', '/docs', '/docs/blueprint', '/docs/foundation', '/docs/stack', '/feedback'];

/**
 * Showcase paths derived from the registry (single source of truth) — every
 * card, sublink, and nested child, minus hub hrefs that only 303-redirect.
 * The Set dedupes "Overview" sublinks that repeat their card's href.
 */
function showcasePaths(): string[] {
	const out = new Set<string>(['/showcases']);
	for (const card of showcases) {
		out.add(card.href);
		for (const sub of card.sublinks ?? []) {
			out.add(sub.href);
			for (const child of sub.children ?? []) out.add(child.href);
		}
	}
	for (const href of REDIRECT_HREFS) out.delete(href);
	return [...out].sort();
}

const STATIC_PATHS = [...BASE_PATHS, ...showcasePaths()];

function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function toDateStr(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/**
 * For a given de-localized logical path, return a map of locale → absolute localized URL.
 * Constructs directly from the known Paraglide URL convention: baseLocale unprefixed,
 * other locales prefixed with `/${locale}`.
 */
function buildLocaleMap(origin: string, path: string): Map<string, string> {
	const map = new Map<string, string>();
	for (const locale of locales) {
		let localizedPath = locale === baseLocale ? path : `/${locale}${path}`;
		// SvelteKit default trailingSlash:'never' — strip trailing slash so sitemap
		// URLs match the canonical served URL (root '/' stays as-is).
		if (localizedPath.length > 1 && localizedPath.endsWith('/')) {
			localizedPath = localizedPath.slice(0, -1);
		}
		map.set(locale, origin + localizedPath);
	}
	return map;
}

/** Build the 4 xhtml:link alternate tags for a page's hreflang cluster. */
function buildAlternates(localeMap: Map<string, string>): string {
	const enUrl = localeMap.get(baseLocale) ?? '';
	return locales
		.map((locale) => {
			const href = localeMap.get(locale) ?? enUrl;
			return `      <xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(href)}"/>`;
		})
		.concat([`      <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(enUrl)}"/>`])
		.join('\n');
}

/**
 * Render one <url> block for a specific locale. `lastmod` is omitted entirely
 * when there is no verifiable modification date — emitting today's date on every
 * crawl makes Google distrust and ignore lastmod across the whole sitemap.
 */
function urlBlock(localeUrl: string, lastmod: string | null, alternates: string): string {
	const lastmodLine = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
	return `  <url>
    <loc>${escapeXml(localeUrl)}</loc>${lastmodLine}
${alternates}
  </url>`;
}

/** Build all <url> blocks for a logical page (3 locale variants). */
function pageBlocks(origin: string, path: string, lastmod: string | null): string {
	const localeMap = buildLocaleMap(origin, path);
	const alternates = buildAlternates(localeMap);
	return locales
		.map((locale) => {
			const localeUrl = localeMap.get(locale) ?? origin + path;
			return urlBlock(localeUrl, lastmod, alternates);
		})
		.join('\n');
}

export const GET: RequestHandler = async ({ url }) => {
	// Prefer stable production origin; fall back to request origin in local dev
	const origin = url.origin === 'http://localhost:5173' || url.origin.includes('localhost') ? PROD_ORIGIN : url.origin;

	// Fetch published posts for dynamic blog entries
	const posts = await listPublishedPostsForFeed(500);

	// Static pages have no verifiable per-page modification date — omit <lastmod>
	// rather than emit a volatile build/crawl date that poisons Google's trust.
	const staticBlocks = STATIC_PATHS.map((path) => pageBlocks(origin, path, null)).join('\n');

	// Blog post blocks
	const postBlocks = posts
		.map((p) => {
			const lastmod = toDateStr(p.publishedAt);
			return pageBlocks(origin, `/blog/${p.slug}`, lastmod);
		})
		.join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${staticBlocks}
${postBlocks}
</urlset>`;

	return new Response(xml.trim(), {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'max-age=0, s-maxage=3600',
		},
	});
};
