/**
 * Service-worker caching policy — pure, unit-testable, imported by
 * src/service-worker/index.ts. The policy is deliberately strict:
 *
 * - HTML and __data.json are NEVER cached (every HTML response is personalized
 *   via the palette transformPageChunk, and __data.json carries root-layout
 *   session data). Offline navigation falls back to the precached /offline page.
 * - Runtime cache admission is a positive allowlist; anything ambiguous is
 *   refused. Query-stringed URLs are refused outright (never normalized) —
 *   cache-key normalization is how cache-deception bugs are born.
 * - Non-GET, /api/* (including SSE streams), and cross-origin requests are
 *   never intercepted at all.
 */

/** Should the service worker handle this request at all? */
export function shouldHandle(request: Request): boolean {
	if (request.method !== 'GET') return false;
	const url = new URL(request.url);
	if (url.pathname.startsWith('/api/')) return false;
	// SSE must never pass through respondWith — buffering kills the stream.
	if (request.headers.get('accept')?.includes('text/event-stream')) return false;
	return true;
}

/** Content-hashed Vite output — immortal by URL, safe to serve cache-first. */
export function isImmutableAsset(url: URL): boolean {
	return url.pathname.startsWith('/_app/immutable/') && url.search === '';
}

/** May this response be written to a cache? Positive allowlist — all must hold. */
export function mayCache(response: Response): boolean {
	if (!response.ok) return false;
	// 'basic' = same-origin, non-opaque. Opaque responses can hide errors and
	// inflate cache quota; never store them.
	if (response.type !== 'basic') return false;
	if (response.headers.get('set-cookie')) return false;
	const cacheControl = response.headers.get('cache-control') ?? '';
	if (cacheControl.includes('no-store') || cacheControl.includes('private')) return false;
	return true;
}

/**
 * The immutable assets the offline page loads, read from its prerendered HTML.
 *
 * The precache holds the offline shell, not the build. Precaching every hashed file
 * cost each first-time visitor the whole client build (~2.2 MB gz of JS plus every
 * font face) in the background, again after every deploy, for routes they may never
 * open. Offline value did not justify it: HTML is never cached, so every offline
 * navigation lands on `/offline` regardless, and that page needs only what it
 * references. Deploy skew does not need it either — when a chunk from an older build
 * is gone, SvelteKit checks `version.json`, updates the worker and reloads natively.
 * Everything else enters the cache cache-first, as it is used (`handleImmutable`).
 *
 * Only paths present in `immutable` (the build's hashed files) are returned, so a
 * malformed or unexpected reference cannot make the worker fetch something outside the
 * hashed output.
 */
export function offlineShellAssets(html: string, immutable: readonly string[]): string[] {
	const known = new Set(immutable);
	const found = new Set<string>();
	for (const match of html.matchAll(/_app\/immutable\/[^"'`\s)]+/g)) {
		const path = `/${match[0]}`;
		if (known.has(path)) found.add(path);
	}
	return [...found];
}

/**
 * The absolute pathname of a `$app/manifest` entry.
 *
 * The manifest lists paths relative to the base path, without a leading slash
 * (`_app/immutable/…`, `icons/icon-192.png`, `offline`). The worker is served from the base
 * path, so resolving against its own URL gives the pathname each fetch and cache entry is
 * keyed by, whatever the base.
 */
export function manifestPathname(path: string, workerUrl: string): string {
	return new URL(path, workerUrl).pathname;
}
