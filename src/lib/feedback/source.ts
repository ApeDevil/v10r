/**
 * Feedback "source" helpers — where a piece of feedback came from.
 *
 * The /feedback form carries the originating page in `pageOfOrigin`,
 * fed by the `?from=` query param. Both the query param and the posted
 * hidden field are attacker-controlled, so values are normalized here:
 * anything that isn't a plain internal path degrades to '' ("no source")
 * instead of failing validation.
 */

import { sanitizeInternalPath } from '$lib/utils/safe-path';

const MAX_SOURCE_LENGTH = 512;

export function sanitizeFeedbackSource(raw: string | null | undefined): string {
	// Full same-origin probe, not a "starts with /" check: `/\evil.com` is
	// `//evil.com` after WHATWG backslash folding. See $lib/utils/safe-path.
	const safe = sanitizeInternalPath((raw ?? '').trim());
	return safe ? safe.slice(0, MAX_SOURCE_LENGTH) : '';
}

/** Route predicate for the pre-footer feedback band: showcases + docs only. */
export function isFeedbackBandPath(pathname: string): boolean {
	return (
		pathname === '/showcases' ||
		pathname.startsWith('/showcases/') ||
		pathname === '/docs' ||
		pathname.startsWith('/docs/')
	);
}
