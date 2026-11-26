/**
 * Feedback "source" helpers — where a piece of feedback came from.
 *
 * The /feedback form carries the originating page in `pageOfOrigin`,
 * fed by the `?from=` query param. Both the query param and the posted
 * hidden field are attacker-controlled, so values are normalized here:
 * anything that isn't a plain internal path degrades to '' ("no source")
 * instead of failing validation.
 */

import { sanitizeInternalPath } from '#lib/utils/safe-path.ts';

const MAX_SOURCE_LENGTH = 512;

export function sanitizeFeedbackSource(raw: string | null | undefined): string {
	// Full same-origin probe, not a "starts with /" check: `/\evil.com` is
	// `//evil.com` after WHATWG backslash folding. See #lib/utils/safe-path.
	const safe = sanitizeInternalPath((raw ?? '').trim());
	// Pathname only: a query string or fragment can carry tokens, search terms or ids
	// the submitter never meant to send.
	const path = safe ? safe.split(/[?#]/, 1)[0] : '';
	return path.slice(0, MAX_SOURCE_LENGTH);
}

const MAX_ROUTE_LENGTH = 200;
const ROUTE_SHAPE = /^\/[A-Za-z0-9_\-./[\]=]*$/;

/**
 * The application area a piece of feedback is about, as a SvelteKit route pattern with the
 * locale and layout-group segments removed: `/[[locale=locale]]/(public)/blog/[slug]` →
 * `/blog/[slug]`. A pattern names parameters, never their values, so it cannot leak a slug,
 * an id or a token the way a concrete path can.
 */
export function feedbackRouteFromRouteId(routeId: string | null | undefined): string {
	if (!routeId) return '';
	const segments = routeId.split('/').filter((s) => s && s !== '[[locale=locale]]' && !/^\(.*\)$/.test(s));
	return `/${segments.join('/')}`;
}

/**
 * Server-side check of the `route` value a link carried in. Attacker-controlled like
 * `?from=`, so anything that is not a plain route pattern degrades to '' (no area).
 */
export function sanitizeFeedbackRoute(raw: string | null | undefined): string {
	const value = (raw ?? '').trim();
	return value.length <= MAX_ROUTE_LENGTH && ROUTE_SHAPE.test(value) && !value.includes('//') ? value : '';
}

const ERROR_ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;

/** The `handleError` id a 5xx page links with — '' unless it has the id shape. */
export function sanitizeFeedbackErrorId(raw: string | null | undefined): string {
	const value = (raw ?? '').trim();
	return ERROR_ID_SHAPE.test(value) ? value : '';
}

/** The `/feedback` link for the page the visitor is on: its path, its area, an optional error id. */
export function feedbackFormHref(pathname: string, routeId: string | null | undefined, errorId?: string): string {
	const params = new URLSearchParams({ from: pathname });
	const route = feedbackRouteFromRouteId(routeId);
	if (route) params.set('route', route);
	if (errorId) params.set('err', errorId);
	return `/feedback?${params.toString()}`;
}

/** Route predicate for the pre-footer feedback band: showcases, workflows, Studio and docs only. */
export function isFeedbackBandPath(pathname: string): boolean {
	return (
		pathname === '/showcases' ||
		pathname.startsWith('/showcases/') ||
		pathname === '/workflows' ||
		pathname.startsWith('/workflows/') ||
		pathname === '/studio' ||
		pathname.startsWith('/studio/') ||
		pathname === '/docs' ||
		pathname.startsWith('/docs/')
	);
}
