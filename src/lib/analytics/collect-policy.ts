/**
 * COLLECTION POLICY — the single source of truth for which requests may be
 * recorded as anonymous pageviews, in ANY lane.
 *
 * Three collectors write anonymous pageviews and MUST agree:
 *   1. `$lib/server/analytics/hook.ts`  — full page loads (server navigation)
 *   2. `/api/analytics/journey`         — client-side navigations (SPA beacon)
 *   3. `$lib/analytics/vercel.ts`       — Vercel Web Analytics `beforeSend`
 *
 * (1) and (2) previously disagreed: the hook excluded `/admin` and `/account`,
 * the beacon endpoint filtered nothing, and the beacon is initialised in the
 * ROOT layout — so every client-side navigation into an authenticated surface
 * was written into the anonymous lane anyway.
 *
 * This module lives OUTSIDE `$lib/server` because collector (3) runs in the
 * browser and `$lib/server` is unimportable from client code. Everything here
 * is a pure function over strings and `Headers`, so there is nothing
 * server-only about it.
 */

/**
 * Locale segments Paraglide may prefix onto any path (`/de/account`).
 *
 * Duplicated from `$lib/paraglide/runtime`'s `locales` deliberately: this
 * module is imported by framework-free domain code, which does not reach into
 * the i18n runtime (see the `event.locals.locale` handoff in `hooks.server.ts`).
 * `analytics.test.ts` asserts the two lists stay in sync, so drift fails the
 * gate rather than silently reopening the hole this closes.
 */
export const LOCALE_SEGMENTS = ['en', 'de', 'ru'] as const;

/**
 * Strip a leading locale segment so path rules can be written once, unprefixed.
 *
 * Without this every rule below is locale-blind: `/account` was excluded from
 * the anonymous lane but `/de/account` was not, so a German-locale visit to an
 * authenticated surface fell through BOTH lanes' prefix checks and landed in
 * the anonymous one — precisely the outcome `EXCLUDED_PREFIXES` exists to
 * prevent. `/en/…` is redirected away by the `stripBaseLocalePrefix` hook, but
 * it is handled here too so this function is correct on its own.
 */
export function stripLocalePrefix(path: string): string {
	for (const locale of LOCALE_SEGMENTS) {
		if (path === `/${locale}`) return '/';
		if (path.startsWith(`/${locale}/`)) return path.slice(1 + locale.length);
	}
	return path;
}

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
	const unprefixed = stripLocalePrefix(path);
	if (EXCLUDED_PREFIXES.some((prefix) => unprefixed.startsWith(prefix))) return true;
	return unprefixed.includes('.');
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
	const unprefixed = stripLocalePrefix(path);
	return USER_LANE_PREFIXES.some((prefix) => unprefixed.startsWith(prefix));
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
