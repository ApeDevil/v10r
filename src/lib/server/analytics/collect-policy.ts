/**
 * COLLECTION POLICY — the single source of truth for which requests enter the
 * ANONYMOUS analytics lane (`analytics.events` + `analytics.sessions`).
 *
 * Two entry points write into that lane and MUST agree:
 *   1. `analytics/hook.ts`              — full page loads (server navigation)
 *   2. `/api/analytics/journey`         — client-side navigations (SPA beacon)
 *
 * They previously disagreed: the hook excluded `/admin` and `/account`, the
 * beacon endpoint filtered nothing, and the beacon is initialised in the ROOT
 * layout — so every client-side navigation into an authenticated surface was
 * written into the anonymous lane anyway. Both now import from here.
 */

/**
 * Route prefixes never recorded in the anonymous lane.
 *
 * `/admin`, `/account` and `/desk` are authenticated surfaces (all three sit
 * behind `requireAdmin`/`requireAuth`). Recording them against a hashed
 * `visitor_id` would place identified users' behaviour into the lane whose
 * legal basis — Art 6(1)(f) legitimate interest — is assessed on the premise
 * that its subjects are anonymous visitors. Authenticated behaviour belongs in
 * `analytics.user_events`, keyed by user id, under a different basis.
 */
const EXCLUDED_PREFIXES = ['/api/', '/_app/', '/admin', '/account', '/desk'] as const;

const BOT_UA_RE =
	/bot|crawler|spider|slurp|baiduspider|facebookexternalhit|whatsapp|twitterbot|linkedinbot|googlebot|bingbot|yandexbot|duckduckbot|applebot|prerender|headless|lighthouse/i;

/**
 * True when the path must not be recorded in the anonymous lane.
 *
 * A dot in the path means a static asset (`favicon.ico`, `robots.txt`,
 * `sitemap.xml`) rather than a page — never a pageview.
 */
export function isExcludedPath(path: string): boolean {
	if (EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
	return path.includes('.');
}

/**
 * Route prefixes recorded in the AUTHENTICATED lane (`analytics.user_events`),
 * keyed by user id rather than by a visitor hash.
 *
 * `/admin` is excluded on purpose: it is the operator's own usage, which is high
 * volume and near-zero insight. `/desk` is excluded by decision, not by law.
 */
const USER_LANE_PREFIXES = ['/account'] as const;

/**
 * True when an authenticated request belongs in the user lane.
 *
 * These paths are ALSO in `EXCLUDED_PREFIXES`, and that is the design: a path is
 * eligible for exactly one lane. Anonymous collection refuses it; user
 * collection claims it, but only when a session is actually present.
 */
export function isUserLanePath(path: string): boolean {
	return USER_LANE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** True when the User-Agent looks like a crawler, preview bot, or headless probe. */
export function isBot(userAgent: string): boolean {
	return BOT_UA_RE.test(userAgent);
}

/**
 * True when the request is a speculative fetch the user never actually saw.
 *
 * `Sec-Purpose` is `prefetch` for a prefetch and `prefetch;prerender` for a
 * prerender, so this substring-matches rather than comparing for equality —
 * exact equality silently admits every Speculation-Rules prerender as a real
 * pageview, which is how sites inflated their own numbers when Chromium
 * shipped speculative loading by default.
 */
export function isPrefetch(headers: Headers): boolean {
	const secPurpose = headers.get('sec-purpose');
	if (secPurpose?.includes('prefetch')) return true;
	if (headers.get('purpose') === 'prefetch') return true;
	return headers.get('x-sveltekit-prefetch') !== null;
}
