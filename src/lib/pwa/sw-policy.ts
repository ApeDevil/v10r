/**
 * Service-worker caching policy — pure, unit-testable, imported by
 * src/service-worker.ts. The policy is deliberately strict:
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
