/**
 * COLLECTION POLICY — the single source of truth for which requests may be
 * recorded as anonymous pageviews, in ANY lane.
 *
 * Three collectors write anonymous pageviews and MUST agree:
 *   1. `$lib/server/analytics/hook.ts`  — full page loads (server navigation)
 *   2. `/api/analytics/journey`         — client-side navigations (SPA beacon)
 *   3. `$lib/analytics/vercel.ts`       — Vercel Web Analytics `beforeSend`
 *
 * They disagree easily: the beacon is initialised in the ROOT layout, so if the
 * hook excludes `/admin` and `/account` but the beacon endpoint filters nothing,
 * every client-side navigation into an authenticated surface still lands in the
 * anonymous lane.
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

/**
 * User-Agent substrings that mark a non-human caller.
 *
 * Grouped by what they are rather than alphabetically, because the groups are
 * maintained at different times and for different reasons. Note that the generic
 * `bot` / `crawler` / `spider` tokens in the first group already sweep up a large
 * share of named crawlers (`gptbot`, `claudebot`, `semrushbot`, `bytespider`, …)
 * — the later groups exist for the callers that declare themselves honestly but
 * do NOT contain any of those tokens, which is most HTTP libraries and scanners.
 *
 * This list is necessary but nowhere near sufficient on its own: it only catches
 * callers that tell the truth. Everything sending a copied browser UA is caught —
 * if at all — by `isBrowserNavigation` below, which is the load-bearing filter.
 */
const BOT_UA_PATTERNS = [
	// Generic self-declarations. Broad on purpose — these carry most of the work.
	'bot',
	'crawler',
	'spider',
	'slurp',
	'prerender',
	'headless',
	'lighthouse',
	// Named search / social / preview fetchers without a generic token.
	'facebookexternalhit',
	'whatsapp',
	'applebot',
	'embedly',
	'quora link preview',
	'skypeuripreview',
	'pinterest',
	'tumblr',
	'mastodon',
	// AI / LLM training and retrieval agents that do not say "bot".
	'anthropic-ai',
	'claude-web',
	'claude-user',
	'chatgpt-user',
	'oai-searchbot',
	// NOT 'google-extended': that is a robots.txt-only control token — Google
	// documents it never appears in a User-Agent string, so matching it here is
	// dead weight that reads as coverage.
	'meta-externalagent',
	'meta-externalfetcher',
	'cohere-ai',
	'omgili',
	'webzio',
	'scrapy',
	// HTTP client libraries. A page view from one of these is never a person.
	'curl',
	'wget',
	'httpie',
	'postman',
	'insomnia',
	'python-requests',
	'python-httpx',
	'aiohttp',
	'go-http-client',
	'java/',
	'okhttp',
	'node-fetch',
	'axios',
	'undici',
	'libwww',
	'lwp::',
	'apache-httpclient',
	'guzzle',
	'restsharp',
	// Security scanners and internet-wide measurement. High volume, zero signal.
	'zgrab',
	'masscan',
	'nuclei',
	'sqlmap',
	'nikto',
	'wpscan',
	'acunetix',
	'gobuster',
	'feroxbuster',
	'censys',
	'expanse',
	'internetmeasurement',
	'netsystemsresearch',
	'paloaltonetworks',
	'l9explore',
	// Uptime and synthetic monitors.
	'pingdom',
	'statuscake',
	'newrelic',
	'datadog',
	'checkly',
	'site24x7',
] as const;

/** No `g` flag — `.test()` on a global regex is stateful and alternates results. */
const BOT_UA_RE = new RegExp(BOT_UA_PATTERNS.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');

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
 * Paths whose whole purpose is to be read by software.
 *
 * This is the measurement that justifies the bot lane existing: whether the
 * agent-facing surfaces are actually consumed. `.md` covers the docs layer served
 * through Accept negotiation, which is the one an AI agent reaches for when it
 * wants the page without the chrome.
 */
export function isAgentSurface(path: string): boolean {
	const unprefixed = stripLocalePrefix(path);
	if (unprefixed === '/llms.txt' || unprefixed === '/robots.txt' || unprefixed === '/sitemap.xml') return true;
	return unprefixed.endsWith('.md');
}

/**
 * Document-ish extensions the bot lane records. Anything else with a dot is an
 * asset — an image, a font, a stylesheet — and a crawler fetching one says
 * nothing a page fetch has not already said.
 */
const BOT_TRACKED_EXTENSIONS = ['.txt', '.md', '.xml', '.json'] as const;

/**
 * True when a non-human request to this path is worth a row.
 *
 * DELIBERATELY NOT `isExcludedPath`. That function refuses any path containing a
 * dot, because for the human lane a dot means a static asset. Applying it here
 * would discard `/robots.txt` and `/llms.txt` — precisely the two fetches with
 * the most signal in the entire lane.
 *
 * It also admits `/admin` and `/account`, which the human lane bars. Those
 * exclusions exist to keep identified people out of an anonymous lane; a crawler
 * probing `/admin` is not a person, and it is exactly the row a security panel
 * wants. Only genuinely uninteresting machine traffic is dropped.
 */
export function isBotTrackablePath(path: string): boolean {
	const unprefixed = stripLocalePrefix(path);
	if (unprefixed.startsWith('/api/') || unprefixed.startsWith('/_app/')) return false;

	const lastDot = unprefixed.lastIndexOf('.');
	const lastSlash = unprefixed.lastIndexOf('/');
	if (lastDot > lastSlash) {
		const ext = unprefixed.slice(lastDot).toLowerCase();
		return (BOT_TRACKED_EXTENSIONS as readonly string[]).includes(ext);
	}
	return true;
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

/**
 * True when the request carries the header shape of a browser loading a page.
 *
 * ## What this is — and emphatically is not
 *
 * A PREFILTER that removes subresources, API calls, prefetches, and the naive
 * HTTP clients that send `Accept: * / *` with no language. It is NOT a bot
 * defense, and it must never be described as load-bearing for the visitor
 * count: `curl-impersonate` ships `Sec-Fetch-Mode: navigate` +
 * `Sec-Fetch-Dest: document` alongside a full Chrome header profile BY
 * DEFAULT, and the W3C Fetch Metadata spec only guarantees these headers
 * against in-page JavaScript forgery — it says nothing about arbitrary HTTP
 * clients. Production data confirmed it: one week of 2026-08 recorded 588
 * "visitors" that passed this test and never executed a line of JavaScript.
 *
 * The counting line that actually holds is CORROBORATION — a session only
 * counts as a confirmed visitor once the client-side confirm ping has fired
 * (`sessions.human_confirmed_at`). Everything this function admits lands in
 * the unconfirmed bucket until then.
 *
 * ## The two acceptance paths
 *
 * When `Sec-Fetch-*` is present, `navigate` + `document` distinguishes a page
 * load from a subresource or API call — that request-shape question is what
 * Fetch Metadata is actually authoritative for. When absent (pre-2020
 * browsers), the fallback checks the weaker pair a browser still always sends:
 * an `Accept` that asks for HTML plus an `Accept-Language`.
 *
 * Known false negatives, accepted: iOS Safari < 16.2 sends no Sec-Fetch
 * headers (caught by the fallback), and some WebViews present odd shapes. A
 * missing visitor is a smaller lie than a hundred fictional ones — and the
 * confirmed/unconfirmed split now bounds the damage in both directions.
 *
 * ## Deliberate scope
 *
 * NAVIGATIONS ONLY. Do not call this from the beacon endpoints: `sendBeacon`
 * and `fetch` produce `Sec-Fetch-Mode: cors`/`no-cors` with
 * `Sec-Fetch-Dest: empty`, so every legitimate beacon would fail it. Those
 * routes are already gated by consent, an Origin check and a session cookie.
 */
export function isBrowserNavigation(headers: Headers): boolean {
	const mode = headers.get('sec-fetch-mode');
	if (mode !== null) {
		if (mode !== 'navigate') return false;
		// Dest is sent alongside mode by every engine that sends mode at all; treat a
		// missing value as acceptable rather than inventing a reason to drop.
		const dest = headers.get('sec-fetch-dest');
		return dest === null || dest === 'document';
	}

	if (!(headers.get('accept') ?? '').includes('text/html')) return false;
	return (headers.get('accept-language') ?? '').length > 0;
}
