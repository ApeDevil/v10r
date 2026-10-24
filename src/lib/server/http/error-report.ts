import type { HandleServerError } from '@sveltejs/kit/hooks';

/**
 * The server `handleError` hook: give an UNEXPECTED error an `errorId` and log it once.
 *
 * SvelteKit 3 passes every error except redirects through this hook and says which kind it is.
 * Only `unknown` is a fault in our code: `app` errors are thrown on purpose with `error()` (a
 * 403 from a guard, a 404 for a missing post), `validation` errors are bad remote-function
 * input, and `framework` errors are SvelteKit's own responses (an unmatched route's 404, a
 * 405). Before SvelteKit 3 the hook never saw `app` errors at all; logging them now would put
 * every intended 404 into the error log with an id nobody needs.
 *
 * Returning nothing keeps SvelteKit's defaults: the `error()` body for `app` errors, the safe
 * status and message otherwise. An unmatched route says "Page not found", as it always has.
 */
export const reportServerError: HandleServerError = ({ kind, error, event }) => {
	if (kind === 'framework') {
		// 404s from unknown routes — no errorId needed
		if (error.status === 404 && event.route.id === null) return { message: 'Page not found' };
		return logged(error.status, error.message, event);
	}
	if (kind === 'unknown') return logged(500, error, event);
	return undefined;
};

function logged(status: number, error: unknown, event: Parameters<HandleServerError>[0]['event']) {
	const errorId = crypto.randomUUID();
	console.error(
		JSON.stringify({
			errorId,
			status,
			path: event.url.pathname,
			route: event.route.id,
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		}),
	);
	return { errorId };
}
