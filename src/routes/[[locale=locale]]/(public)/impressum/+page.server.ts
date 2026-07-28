import type { PageServerLoad } from './$types';

/**
 * IMPRESSUM — § 5 DDG / § 18 Abs. 2 MStV provider identification.
 *
 * SSR, never prerendered. The `X-Robots-Tag` below has to be a real response
 * header, and a prerendered page has no request to hang one on.
 *
 * ## Deliberately NOT rate limited
 *
 * Every other public write path in this app sits behind `createLimiter`. This
 * one must not. `createLimiter` fails CLOSED — no Redis in production, or a
 * hard Upstash error at runtime, and it returns 429 for everything. On any
 * other route that is a correct trade. Here it would turn an Upstash blip into
 * a breach of § 5 DDG "ständig verfügbar", which is the one property this page
 * exists to have. A limiter that can 429 the legally mandated page is worse
 * than the scraping it would prevent — and scrapers fetch it once anyway, so
 * the limiter never sees the traffic pattern it is built to catch.
 *
 * Scraper defence lives where it actually works: `robots.txt` blocks the AI
 * crawlers from fetching at all, and the headers below keep the address out of
 * search indexes and snippets.
 */
export const prerender = false;

export const load: PageServerLoad = async ({ setHeaders }) => {
	// Paired with <meta name="robots"> in the page — the header is what a
	// non-HTML-parsing fetcher sees, the meta is what a renderer sees.
	//
	//   noindex    keep the postal address out of search indexes
	//   noarchive  no cached copy served from a results page
	//   nosnippet  no address preview even if the URL is indexed via a backlink
	//   noai       non-standard, honoured by a growing set of crawlers; free to send
	setHeaders({
		'X-Robots-Tag': 'noindex, noarchive, nosnippet, noai, noimageai',
	});

	return {};
};
