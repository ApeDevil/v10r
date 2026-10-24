/**
 * Which responses may carry the style cookie.
 *
 * The cookie only matters to a response that renders the app shell — an HTML page or a
 * page's `__data.json`. Stamped on anything else, it is pure cost: `robots.txt`,
 * `sitemap.xml`, `llms.txt` and the blog feed all declare `s-maxage`, and Vercel's CDN
 * refuses to cache any response carrying `Set-Cookie`. Crawlers arrive cookieless, so
 * every crawler fetch got a fresh random style, missed the cache, and — for the sitemap
 * — woke Postgres.
 *
 * Decided from the finished response rather than from the route because the response is
 * the structural fact: SvelteKit does not expose page-versus-endpoint to `handle`, and a
 * path list would silently miss the next endpoint someone adds.
 */
import { STYLE_COOKIE_NAME } from '#lib/styles/random/index.ts';

/** True when the response renders the app shell, the only consumer of the style. */
export function rendersAppShell(response: Response, isDataRequest: boolean): boolean {
	if (isDataRequest) return true;
	return (response.headers.get('content-type') ?? '').startsWith('text/html');
}

/**
 * Remove the style cookie's `Set-Cookie` from a response that does not render the app
 * shell, leaving every other cookie in place. A response with immutable headers is left
 * untouched — losing a cache opportunity must never become a 500.
 */
export function scopeStyleCookie(response: Response, isDataRequest: boolean): void {
	if (rendersAppShell(response, isDataRequest)) return;
	try {
		const all = response.headers.getSetCookie();
		const kept = all.filter((line) => !line.startsWith(`${STYLE_COOKIE_NAME}=`));
		if (kept.length === all.length) return;
		response.headers.delete('set-cookie');
		for (const line of kept) response.headers.append('set-cookie', line);
	} catch {
		// Immutable headers (a `Response.redirect()` downstream): nothing to scope.
	}
}
