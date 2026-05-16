import { baseLocale, locales } from '$lib/paraglide/runtime';
import { listPublishedPostsForFeed } from '$lib/server/blog';
import type { RequestHandler } from './$types';

const PROD_ORIGIN = 'https://www.v10r.dev';

/** Static public pages that belong in the sitemap. */
const STATIC_PATHS = [
	'/',
	'/blog',
	'/docs',
	'/docs/blueprint',
	'/docs/foundation',
	'/docs/stack',
	'/feedback',
	'/showcases',
	'/showcases/3d',
	'/showcases/3d/animated-scene',
	'/showcases/3d/static-scene',
	'/showcases/abuse',
	'/showcases/abuse/ai-budget',
	'/showcases/abuse/captcha',
	'/showcases/abuse/honeypot',
	'/showcases/abuse/rate-limits',
	'/showcases/admin',
	'/showcases/admin/cookies',
	'/showcases/admin/data',
	'/showcases/admin/powers',
	'/showcases/admin/retention',
	'/showcases/admin/rights',
	'/showcases/ai/chat',
	'/showcases/ai/retrieval',
	'/showcases/ai/retrieval/explorer',
	'/showcases/ai/retrieval/ingest',
	'/showcases/ai/retrieval/rag-chat',
	'/showcases/analytics/funnels',
	'/showcases/analytics/journeys',
	'/showcases/analytics/live',
	'/showcases/analytics/my-data',
	'/showcases/analytics/overview',
	'/showcases/analytics/privacy',
	'/showcases/auth/connection',
	'/showcases/auth/security',
	'/showcases/auth/session',
	'/showcases/cycle/ai',
	'/showcases/cycle/api',
	'/showcases/cycle/form',
	'/showcases/db/cache/connection',
	'/showcases/db/cache/ephemeral',
	'/showcases/db/cache/patterns',
	'/showcases/db/graph/connection',
	'/showcases/db/graph/model',
	'/showcases/db/graph/traversal',
	'/showcases/db/relational/connection',
	'/showcases/db/relational/mutability',
	'/showcases/db/relational/types',
	'/showcases/db/storage/connection',
	'/showcases/db/storage/objects',
	'/showcases/db/storage/transfer',
	'/showcases/forms/advanced/confirm',
	'/showcases/forms/advanced/edit',
	'/showcases/forms/advanced/reset',
	'/showcases/forms/auth',
	'/showcases/forms/basics/contact',
	'/showcases/forms/basics/settings',
	'/showcases/forms/patterns/dependent',
	'/showcases/forms/patterns/dynamic',
	'/showcases/forms/patterns/wizard',
	'/showcases/forms/validation/async',
	'/showcases/forms/validation/realtime',
	'/showcases/forms/validation/server',
	'/showcases/i18n',
	'/showcases/jobs',
	'/showcases/notifications/channels',
	'/showcases/notifications/pipeline',
	'/showcases/notifications/send',
	'/showcases/shell/errors',
	'/showcases/shell/modals',
	'/showcases/shell/session',
	'/showcases/shell/shortcuts',
	'/showcases/shell/sidebar',
	'/showcases/shell/style',
	'/showcases/shell/toasts',
	'/showcases/ui/components/composites',
	'/showcases/ui/components/primitives',
	'/showcases/ui/decorative/backgrounds',
	'/showcases/ui/decorative/ornaments',
	'/showcases/ui/layouts',
	'/showcases/ui/menus',
	'/showcases/ui/splits/reorderable',
	'/showcases/ui/splits/resizable',
	'/showcases/ui/tables',
	'/showcases/ui/tokens',
	'/showcases/ui/typography',
	'/showcases/ui/workbench',
	'/showcases/viz',
	'/showcases/viz/charts',
	'/showcases/viz/diagrams',
	'/showcases/viz/graphs',
	'/showcases/viz/maps',
	'/showcases/viz/plots',
];

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
