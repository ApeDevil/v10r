/**
 * Wraps a deferred promise with a .catch() to prevent unhandled rejections
 * from crashing the Vercel serverless process (SvelteKit #9785).
 *
 * Use this for every promise returned as a deferred value from streaming load functions.
 */
export function safeDeferPromise<T>(promise: Promise<T>, fallback: T): Promise<T> {
	return promise.catch((err) => {
		console.error('[safe-defer] Deferred promise rejected:', err);
		return fallback;
	});
}
