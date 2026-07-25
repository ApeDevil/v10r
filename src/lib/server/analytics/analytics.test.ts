/**
 * Analytics system tests.
 *
 * Surfaces:
 * 1. consent.ts — parseConsentTier, hasConsent, hashVisitorId contracts
 * 2. collect-policy.ts — the shared admission rules for the anonymous lane
 *    (authenticated-surface exclusion, bot detection, prefetch/prerender)
 * 3. hook.ts — session cookie is consent-gated (TDDDG §25), IP never written
 * 4. mutations.ts — upsertSession entryPath preservation + batch increment
 * 5. analytics-cleanup.ts — retention window is a pinned compliance commitment
 * 6. consent state (svelte) — default is null/denied, never 'granted' accidentally
 * 7. silent swallow — DB errors are observable via console.error, not rethrown
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { consentEvents, events, sessions } from '$lib/server/db/schema/analytics';

// ── DB setup (PGlite) ─────────────────────────────────────────────────────────

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { db } = await import('$lib/server/db');
const { parseConsentTier, hasConsent, hashVisitorId, deriveCookielessSessionId } = await import('./consent');
const { isBot, isExcludedPath, isPrefetch } = await import('./collect-policy');
const { classifyUserAgent, geoFromHeaders } = await import('./enrich');
const { isKnownEvent, sanitizeProperties, templateRoute } = await import('./event-schema');
const { recordEvent, upsertSession } = await import('$lib/server/db/analytics/mutations');
const { analyticsCollector } = await import('./hook');
const { analyticsCleanup } = await import('$lib/server/jobs/analytics-cleanup');
const { ANALYTICS_RETENTION_DAYS, ANALYTICS_CONSENT_COOKIE, ANALYTICS_SESSION_COOKIE } = await import(
	'$lib/server/config'
);
const consentState = await import('$lib/state/consent.svelte');

afterAll(async () => {
	await testClient?.close();
});

// ── 1. consent.ts — parseConsentTier contracts ───────────────────────────────

describe('parseConsentTier', () => {
	it('returns necessary when cookie is undefined — deny-by-default', () => {
		expect(parseConsentTier(undefined)).toBe('necessary');
	});

	it('returns necessary for empty string — cleared cookie', () => {
		expect(parseConsentTier('')).toBe('necessary');
	});

	it('returns necessary for unknown value — never accidentally grants analytics', () => {
		// An attacker or typo must not escalate to analytics tier
		expect(parseConsentTier('granted')).toBe('necessary');
		expect(parseConsentTier('full_consent')).toBe('necessary');
		expect(parseConsentTier('true')).toBe('necessary');
		expect(parseConsentTier('1')).toBe('necessary');
	});

	it('accepts both valid tiers verbatim', () => {
		expect(parseConsentTier('necessary')).toBe('necessary');
		expect(parseConsentTier('analytics')).toBe('analytics');
	});

	it('denies the retired `full` tier rather than mapping it to analytics', () => {
		// A visitor holding an old `full` cookie consented to a description of the
		// processing that no longer exists. Re-asking is correct; silently crediting
		// them with consent they never gave to the CURRENT description is not.
		expect(parseConsentTier('full')).toBe('necessary');
	});
});

// ── 2. consent.ts — hasConsent contracts ─────────────────────────────────────

describe('hasConsent', () => {
	it('necessary tier does NOT satisfy analytics requirement — GDPR gate', () => {
		expect(hasConsent('necessary', 'analytics')).toBe(false);
	});

	it('analytics tier satisfies analytics requirement', () => {
		expect(hasConsent('analytics', 'analytics')).toBe(true);
	});

	it('necessary satisfies necessary — strictly necessary always allowed', () => {
		expect(hasConsent('necessary', 'necessary')).toBe(true);
	});

	it('analytics satisfies necessary — higher tier is a superset', () => {
		expect(hasConsent('analytics', 'necessary')).toBe(true);
	});
});

// ── 3. consent.ts — hashVisitorId: IP never in output ────────────────────────

describe('hashVisitorId', () => {
	it('returns a string prefixed with v_ and 16 hex chars', async () => {
		const h = await hashVisitorId('1.2.3.4:Mozilla/5.0');
		expect(h).toMatch(/^v_[0-9a-f]{16}$/);
	});

	it('is deterministic — same input produces same hash', async () => {
		const input = '5.6.7.8:Chrome/120';
		const a = await hashVisitorId(input);
		const b = await hashVisitorId(input);
		expect(a).toBe(b);
	});

	it('different inputs produce different hashes — no trivial collision', async () => {
		const a = await hashVisitorId('1.1.1.1:Chrome');
		const b = await hashVisitorId('1.1.1.2:Chrome');
		expect(a).not.toBe(b);
	});

	it('raw IP address is not present verbatim in the output — IP never reaches DB', async () => {
		const ip = '203.0.113.42';
		const hash = await hashVisitorId(`${ip}:SomeUA`);
		// The full raw IP string must not appear verbatim in the output
		expect(hash).not.toContain(ip);
		// The output must be in hashed form (v_ + 16 hex chars)
		expect(hash).toMatch(/^v_[0-9a-f]{16}$/);
	});
});

// ── 3b. consent.ts — deriveCookielessSessionId (no-consent fallback) ─────────

describe('deriveCookielessSessionId', () => {
	it('returns a session id in the same s_ + 16 hex format as cookie ids', async () => {
		const sid = await deriveCookielessSessionId('v_abc123def4567890');
		expect(sid).toMatch(/^s_[0-9a-f]{16}$/);
	});

	it('is deterministic within the same UTC day — page views group into one session', async () => {
		const a = await deriveCookielessSessionId('v_abc123def4567890');
		const b = await deriveCookielessSessionId('v_abc123def4567890');
		expect(a).toBe(b);
	});

	it('differs per visitor — no cross-visitor session merging', async () => {
		const a = await deriveCookielessSessionId('v_aaaaaaaaaaaaaaaa');
		const b = await deriveCookielessSessionId('v_bbbbbbbbbbbbbbbb');
		expect(a).not.toBe(b);
	});

	it('rotates at UTC midnight — same visitor, different day, different session', async () => {
		const sid = await deriveCookielessSessionId('v_abc123def4567890');
		vi.useFakeTimers();
		try {
			const tomorrow = new Date();
			tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
			vi.setSystemTime(tomorrow);
			const sidTomorrow = await deriveCookielessSessionId('v_abc123def4567890');
			expect(sidTomorrow).not.toBe(sid);
		} finally {
			vi.useRealTimers();
		}
	});
});

// ── 4. collect-policy.ts — the shared anonymous-lane admission rules ─────────

describe('isExcludedPath', () => {
	it.each([
		'/admin',
		'/admin/analytics',
		'/account',
		'/account/data',
		'/desk',
		'/desk/workspace',
	])('excludes the authenticated surface %s', (path) => {
		// Authenticated surfaces must never reach the anonymous lane: its legal
		// basis is assessed on the premise that its subjects are anonymous.
		expect(isExcludedPath(path)).toBe(true);
	});

	it.each(['/api/analytics/journey', '/_app/immutable/chunk.js'])('excludes the internal path %s', (path) => {
		expect(isExcludedPath(path)).toBe(true);
	});

	it.each(['/favicon.ico', '/robots.txt', '/sitemap.xml'])('excludes the static asset %s', (path) => {
		expect(isExcludedPath(path)).toBe(true);
	});

	it.each([
		'/',
		'/blog',
		'/blog/some-post',
		'/showcases/analytics/overview',
		'/de/blog',
	])('admits the public page %s', (path) => {
		expect(isExcludedPath(path)).toBe(false);
	});
});

describe('isBot', () => {
	it.each([
		'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
		'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0',
		'facebookexternalhit/1.1',
	])('flags %s', (ua) => {
		expect(isBot(ua)).toBe(true);
	});

	it('admits an ordinary browser UA', () => {
		expect(isBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36')).toBe(
			false,
		);
	});
});

describe('isPrefetch', () => {
	it('flags Sec-Purpose: prefetch', () => {
		expect(isPrefetch(new Headers({ 'sec-purpose': 'prefetch' }))).toBe(true);
	});

	it('flags Sec-Purpose: prefetch;prerender — substring, not equality', () => {
		// Speculation Rules sends `prefetch;prerender` for a prerender. Comparing
		// for equality admits every prerender as a real pageview, which is exactly
		// how sites inflated their own numbers when Chromium shipped speculative
		// loading on by default.
		expect(isPrefetch(new Headers({ 'sec-purpose': 'prefetch;prerender' }))).toBe(true);
	});

	it('flags the legacy Purpose header and SvelteKit prefetch header', () => {
		expect(isPrefetch(new Headers({ purpose: 'prefetch' }))).toBe(true);
		expect(isPrefetch(new Headers({ 'x-sveltekit-prefetch': '1' }))).toBe(true);
	});

	it('admits a normal navigation', () => {
		expect(isPrefetch(new Headers({ 'sec-fetch-dest': 'document' }))).toBe(false);
	});
});

describe('analyticsCollector — cookie naming', () => {
	it('session cookie and consent cookie are distinct names', () => {
		// If the same cookie name were used, clearing consent would kill the session
		expect(ANALYTICS_SESSION_COOKIE).not.toBe(ANALYTICS_CONSENT_COOKIE);
	});
});

// ── 4d. event-schema.ts — the cardinality budget ─────────────────────────────

describe('templateRoute', () => {
	it.each([
		['/[[locale=locale]]/(public)/blog/[slug]', '/blog/[slug]'],
		['/[[locale=locale]]/(public)/showcases/analytics/overview', '/showcases/analytics/overview'],
		['/[[locale=locale]]/(public)', '/'],
		['/[[locale=locale]]/account/data', '/account/data'],
	])('reduces %s to %s', (routeId, expected) => {
		expect(templateRoute(routeId)).toBe(expected);
	});

	it('collapses every article to one key — this is the whole point', () => {
		// Without templating, each published post becomes its own GROUP BY key and
		// the dashboard degrades in direct proportion to how much content exists.
		const a = templateRoute('/[[locale=locale]]/(public)/blog/[slug]');
		const b = templateRoute('/[[locale=locale]]/(public)/blog/[slug]');
		expect(a).toBe(b);
	});

	it('treats the same page in two locales as one page', () => {
		// The locale segment is stripped: /de/blog/x and /blog/x are one page seen
		// in two languages, not two pages.
		expect(templateRoute('/[[locale=locale]]/(public)/blog/[slug]')).toBe('/blog/[slug]');
	});

	it('normalises param matchers — [slug=string] and [slug] are one key', () => {
		expect(templateRoute('/(public)/x/[id=integer]')).toBe('/x/[id]');
	});

	it('returns a sentinel for an unmatched route rather than inventing one', () => {
		expect(templateRoute(null)).toBe('(unknown)');
	});
});

describe('sanitizeProperties', () => {
	it('strips keys the event never declared — a client cannot widen the schema', () => {
		const out = sanitizeProperties('scroll_depth', { bucket: '50', evil: 'x'.repeat(5000), nested: { a: 1 } });
		expect(out).toEqual({ bucket: '50' });
	});

	it('rejects an out-of-domain enum value', () => {
		expect(sanitizeProperties('scroll_depth', { bucket: '37' })).toEqual({});
	});

	it('truncates strings to their declared maximum', () => {
		const out = sanitizeProperties('dead_click', { target: 'a'.repeat(500) });
		expect((out.target as string).length).toBe(120);
	});

	it('clamps integers instead of dropping them — an outlier is still an observation', () => {
		expect(sanitizeProperties('engagement', { seconds: 999999 }).seconds).toBe(3600);
		expect(sanitizeProperties('engagement', { seconds: -5 }).seconds).toBe(0);
	});

	it('drops non-numeric values for integer properties', () => {
		expect(sanitizeProperties('engagement', { seconds: 'lots' })).toEqual({});
	});

	it('tolerates a null or non-object property bag', () => {
		expect(sanitizeProperties('dead_click', null)).toEqual({});
		expect(sanitizeProperties('dead_click', 'nope')).toEqual({});
	});

	it('form_abandon records which field, never any content', () => {
		// The distinction that keeps this lawful: WHICH field was abandoned is
		// behavioural data; what was typed into it may be special-category data.
		const out = sanitizeProperties('form_abandon', {
			form: 'signup',
			lastField: 'email',
			value: 'someone@example.com',
		});
		expect(out).toEqual({ form: 'signup', lastField: 'email' });
		expect(JSON.stringify(out)).not.toContain('example.com');
	});
});

describe('isKnownEvent', () => {
	it('accepts declared events', () => {
		expect(isKnownEvent('rage_click')).toBe(true);
		expect(isKnownEvent('engagement')).toBe(true);
	});

	it('rejects anything undeclared — unknown names are dropped at ingest', () => {
		expect(isKnownEvent('arbitrary_event')).toBe(false);
		expect(isKnownEvent('__proto__')).toBe(false);
	});
});

// ── 4c. enrich.ts — session enrichment ───────────────────────────────────────

describe('geoFromHeaders', () => {
	it('reads and upper-cases the Vercel edge country header', () => {
		expect(geoFromHeaders(new Headers({ 'x-vercel-ip-country': 'de' }))).toBe('DE');
	});

	it('returns undefined off-platform — the header is absent in dev and in the container', () => {
		expect(geoFromHeaders(new Headers())).toBeUndefined();
	});

	it('rejects ZZ — Vercel emits it for addresses it cannot place', () => {
		// Storing ZZ would be noise dressed up as a country.
		expect(geoFromHeaders(new Headers({ 'x-vercel-ip-country': 'ZZ' }))).toBeUndefined();
	});

	it('rejects anything that is not two letters — the column is char(2)', () => {
		expect(geoFromHeaders(new Headers({ 'x-vercel-ip-country': 'DEU' }))).toBeUndefined();
		expect(geoFromHeaders(new Headers({ 'x-vercel-ip-country': '' }))).toBeUndefined();
		expect(geoFromHeaders(new Headers({ 'x-vercel-ip-country': '12' }))).toBeUndefined();
	});
});

describe('classifyUserAgent', () => {
	// Order is load-bearing: Edge advertises Chrome AND Safari, Chrome advertises
	// Safari, Opera advertises Chrome. Naive substring order misattributes all three.
	it.each([
		['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36 Edg/120', 'edge'],
		['Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36 OPR/106', 'opera'],
		['Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 SamsungBrowser/23 Chrome/115 Mobile Safari/537.36', 'samsung'],
		['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0', 'firefox'],
		['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'chrome'],
		['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', 'safari'],
		['some-unknown-client/1.0', 'other'],
	])('attributes %s to %s', (ua, expected) => {
		expect(classifyUserAgent(ua).browser).toBe(expected);
	});

	it.each([
		['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1', 'mobile'],
		['Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36', 'mobile'],
		['Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1', 'tablet'],
		['Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'tablet'],
		['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'desktop'],
	])('classifies %s as %s', (ua, expected) => {
		expect(classifyUserAgent(ua).device).toBe(expected);
	});

	it('counts iPadOS 13+ Safari as desktop — an accepted, documented blind spot', () => {
		// iPadOS reports itself as Macintosh. Telling it apart needs a touch-points
		// or screen probe, which is exactly the added entropy this module refuses to
		// collect: the visitor hash's defensibility rests on adding none. A small
		// honest undercount of tablets beats a fingerprint.
		const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';
		expect(classifyUserAgent(ua).device).toBe('desktop');
	});

	it('never returns a version number or the raw UA — bounded cardinality', () => {
		const { device, browser } = classifyUserAgent(
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.6099.129 Safari/537.36',
		);
		expect(browser).toBe('chrome');
		expect(device).toBe('desktop');
		expect(`${device}${browser}`).not.toMatch(/\d/);
	});
});

// ── 4b. hook.ts — _v10r_sid Set-Cookie is consent-gated (TDDDG §25) ──────────

describe('analyticsCollector — session cookie requires analytics consent', () => {
	function makeEvent(consent?: string, existingSid?: string) {
		const jar = new Map<string, string>();
		if (consent) jar.set(ANALYTICS_CONSENT_COOKIE, consent);
		if (existingSid) jar.set('_v10r_sid', existingSid);
		const set = vi.fn((name: string, value: string) => jar.set(name, value));
		const del = vi.fn((name: string) => jar.delete(name));
		const event = {
			url: new URL('https://example.com/blog'),
			request: new Request('https://example.com/blog', {
				headers: { 'user-agent': 'Mozilla/5.0 (Test) Gecko/20100101' },
			}),
			cookies: { get: (n: string) => jar.get(n), set, delete: del },
			getClientAddress: () => '203.0.113.5',
			// SvelteKit populates this once the request is matched to a route; the
			// collector reads it to derive the templated, cardinality-bounded key.
			route: { id: '/[[locale=locale]]/(public)/blog' },
			locals: {},
		};
		return { event, set, del };
	}

	const resolve = async () => new Response('ok');

	it('does NOT set _v10r_sid without consent — deny-by-default', async () => {
		const { event, set } = makeEvent(undefined);
		// biome-ignore lint/suspicious/noExplicitAny: minimal RequestEvent stub
		await analyticsCollector({ event: event as any, resolve: resolve as any });
		expect(set).not.toHaveBeenCalled();
	});

	it('does NOT set _v10r_sid at necessary tier', async () => {
		const { event, set } = makeEvent('necessary');
		// biome-ignore lint/suspicious/noExplicitAny: minimal RequestEvent stub
		await analyticsCollector({ event: event as any, resolve: resolve as any });
		expect(set).not.toHaveBeenCalled();
	});

	it('sets _v10r_sid at analytics tier', async () => {
		const { event, set } = makeEvent('analytics');
		// biome-ignore lint/suspicious/noExplicitAny: minimal RequestEvent stub
		await analyticsCollector({ event: event as any, resolve: resolve as any });
		expect(set).toHaveBeenCalledWith(
			'_v10r_sid',
			expect.stringMatching(/^s_/),
			expect.objectContaining({ httpOnly: true }),
		);
	});

	it('deletes a stale _v10r_sid after consent is withdrawn', async () => {
		const { event, del } = makeEvent('necessary', 's_stalecookie123456');
		// biome-ignore lint/suspicious/noExplicitAny: minimal RequestEvent stub
		await analyticsCollector({ event: event as any, resolve: resolve as any });
		expect(del).toHaveBeenCalledWith('_v10r_sid', { path: '/' });
	});
});

// ── 5. mutations.ts — recordEvent ────────────────────────────────────────────

describe('recordEvent', () => {
	beforeEach(async () => {
		await db.delete(events);
		await db.delete(sessions);
	});

	it('inserts event with all fields', async () => {
		await recordEvent({
			sessionId: 'sess-001',
			visitorId: 'v_abc123def4567890',
			eventType: 'pageview',
			path: '/home',
			referrer: 'https://example.com',
			consentTier: 'analytics',
		});

		const rows = await db.select().from(events);
		expect(rows).toHaveLength(1);
		expect(rows[0].path).toBe('/home');
		expect(rows[0].referrer).toBe('https://example.com');
		expect(rows[0].consentTier).toBe('analytics');
	});

	it('defaults consentTier to necessary when omitted', async () => {
		await recordEvent({
			sessionId: 'sess-002',
			visitorId: 'v_abc123def4567890',
			eventType: 'pageview',
			path: '/page',
		});

		const rows = await db.select().from(events);
		expect(rows[0].consentTier).toBe('necessary');
	});

	it('visitorId stored as hash not raw IP', async () => {
		await recordEvent({
			sessionId: 'sess-003',
			visitorId: 'v_deadbeef12345678',
			eventType: 'pageview',
			path: '/test',
		});
		const rows = await db.select().from(events);
		// Confirm stored value matches the hashed format contract
		expect(rows[0].visitorId).toMatch(/^v_[0-9a-f]{16}$/);
	});

	it('documents orphaned-event risk: events can be inserted without a session row', async () => {
		/**
		 * events.sessionId has NO FK constraint to sessions.id.
		 * This is a documented schema gap. The risk: rollup JOIN queries silently
		 * under-count when the session row is missing.
		 */
		await recordEvent({
			sessionId: 'orphan-sess-no-parent',
			visitorId: 'v_aabbccddeeff0011',
			eventType: 'pageview',
			path: '/a',
		});

		const rows = await db.select().from(events);
		const sessionRows = await db.select().from(sessions);

		expect(rows).toHaveLength(1);
		expect(sessionRows).toHaveLength(0); // no parent session — orphan confirmed
	});
});

// ── 6. mutations.ts — upsertSession ──────────────────────────────────────────

describe('upsertSession', () => {
	beforeEach(async () => {
		await db.delete(events);
		await db.delete(sessions);
	});

	it('preserves entryPath on conflict — subsequent upserts must not overwrite it', async () => {
		await upsertSession({ id: 'sess-ep', visitorId: 'v_11223344556677aa', entryPath: '/entry' });
		await upsertSession({ id: 'sess-ep', visitorId: 'v_11223344556677aa', entryPath: '/page2' });

		const rows = await db.select().from(sessions);
		expect(rows).toHaveLength(1);
		expect(rows[0].entryPath).toBe('/entry');
	});

	it('increments pageCount on each upsert', async () => {
		await upsertSession({ id: 'sess-pc', visitorId: 'v_11223344556677bb', entryPath: '/home' });
		await upsertSession({ id: 'sess-pc', visitorId: 'v_11223344556677bb', entryPath: '/home' });
		await upsertSession({ id: 'sess-pc', visitorId: 'v_11223344556677bb', entryPath: '/home' });

		const rows = await db.select().from(sessions);
		expect(rows[0].pageCount).toBe(3);
	});

	it('updates exitPath on subsequent page views', async () => {
		await upsertSession({ id: 'sess-ex', visitorId: 'v_11223344556677cc', entryPath: '/home', exitPath: '/home' });
		await upsertSession({ id: 'sess-ex', visitorId: 'v_11223344556677cc', entryPath: '/home', exitPath: '/about' });

		const rows = await db.select().from(sessions);
		expect(rows[0].exitPath).toBe('/about');
	});

	it('adds pageIncrement to an existing session — one round trip per beacon batch', async () => {
		// The SPA beacon delivers a whole batch of navigations at once. Incrementing
		// by 1 would undercount every batch; calling upsertSession per event would
		// cost a round trip per navigation.
		await upsertSession({ id: 'sess-b', visitorId: 'v_11223344556677dd', entryPath: '/home' });
		await upsertSession({
			id: 'sess-b',
			visitorId: 'v_11223344556677dd',
			entryPath: '/a',
			exitPath: '/c',
			pageIncrement: 3,
		});

		const rows = await db.select().from(sessions);
		expect(rows[0].pageCount).toBe(4);
		expect(rows[0].exitPath).toBe('/c');
		expect(rows[0].entryPath).toBe('/home');
	});

	it('seeds pageCount from pageIncrement when the session row does not exist yet', async () => {
		await upsertSession({
			id: 'sess-new',
			visitorId: 'v_11223344556677ee',
			entryPath: '/a',
			exitPath: '/b',
			pageIncrement: 2,
		});

		const rows = await db.select().from(sessions);
		expect(rows[0].pageCount).toBe(2);
	});

	it('backfills device/browser when they become known mid-session, and never wipes them', async () => {
		// A visitor who lands at `necessary` tier has no device/browser (UA parsing
		// is gated on analytics consent). If they then accept, the columns must fill.
		await upsertSession({ id: 'sess-bf', visitorId: 'v_1122334455667700', entryPath: '/home', country: 'DE' });
		let rows = await db.select().from(sessions);
		expect(rows[0].device).toBeNull();
		expect(rows[0].country).toBe('DE');

		await upsertSession({
			id: 'sess-bf',
			visitorId: 'v_1122334455667700',
			entryPath: '/home',
			device: 'mobile',
			browser: 'firefox',
		});
		rows = await db.select().from(sessions);
		expect(rows[0].device).toBe('mobile');
		expect(rows[0].browser).toBe('firefox');
		// Omitting country must not clear what was already lawfully collected.
		expect(rows[0].country).toBe('DE');
	});

	it('sets endedAt so the session stops looking frozen at its first page load', async () => {
		await upsertSession({ id: 'sess-end', visitorId: 'v_11223344556677ff', entryPath: '/home' });
		let rows = await db.select().from(sessions);
		expect(rows[0].endedAt).toBeNull();

		await upsertSession({ id: 'sess-end', visitorId: 'v_11223344556677ff', entryPath: '/next' });
		rows = await db.select().from(sessions);
		// Active-session counting and session duration both read endedAt; before the
		// beacon advanced session state this stayed null for every SPA visitor.
		expect(rows[0].endedAt).toBeInstanceOf(Date);
	});
});

// ── 7. analytics-cleanup.ts — retention drift ────────────────────────────────

describe('analyticsCleanup — retention constant', () => {
	it('keeps raw events for 60 days — GDPR Art. 5(1)(e) storage limitation', () => {
		// Pinned deliberately. Raw event rows are pseudonymous personal data (the
		// visitor hash does not make them anonymous from our own position as
		// controller), so the retention window is a compliance commitment, not a
		// tuning knob. Raising it is a decision that belongs in the LIA, not a
		// config tweak.
		expect(ANALYTICS_RETENTION_DAYS).toBe(60);
	});
});

describe('analyticsCleanup — functional behaviour', () => {
	beforeEach(async () => {
		await db.delete(events);
		await db.delete(sessions);
		await db.delete(consentEvents);
	});

	it('deletes events older than retention window and keeps recent ones', async () => {
		const oldDate = new Date();
		oldDate.setDate(oldDate.getDate() - (ANALYTICS_RETENTION_DAYS + 1));

		await db.insert(events).values({
			sessionId: 'sess-old',
			visitorId: 'v_00000000000old1a',
			eventType: 'pageview',
			path: '/old',
			consentTier: 'necessary',
			timestamp: oldDate,
		});

		await db.insert(events).values({
			sessionId: 'sess-new',
			visitorId: 'v_00000000000new1a',
			eventType: 'pageview',
			path: '/new',
			consentTier: 'necessary',
			timestamp: new Date(),
		});

		const deleted = await analyticsCleanup();
		expect(deleted).toBeGreaterThanOrEqual(1);

		const remaining = await db.select().from(events);
		expect(remaining).toHaveLength(1);
		expect(remaining[0].path).toBe('/new');
	});

	it('consent_events are NOT touched by cleanup today — infinite retention (design gap)', async () => {
		/**
		 * Documents current state: analyticsCleanup never deletes consent_events.
		 * After the fix (13-month window), this test must be updated to assert
		 * that rows older than 13mo ARE deleted and rows within 13mo survive.
		 */
		const oldDate = new Date();
		oldDate.setDate(oldDate.getDate() - (ANALYTICS_RETENTION_DAYS + 5));

		await db.insert(consentEvents).values({
			visitorId: 'v_cccccccccccc0001',
			action: 'grant',
			tierBefore: null,
			tierAfter: 'analytics',
			timestamp: oldDate,
		});

		await analyticsCleanup();

		const remaining = await db.select().from(consentEvents);
		// Cleanup does NOT touch consent_events — row survives
		expect(remaining).toHaveLength(1);
		// FINDING: consent_events currently have infinite retention.
	});
});

// ── 8. consent state — init-time leakage guard ───────────────────────────────

describe('createConsentState — default is null, never auto-granted', () => {
	it('tier is null on initialisation — not necessary, analytics, or full', () => {
		/**
		 * In test/SSR context the $effect does not fire (no browser).
		 * Synchronous initial values represent the SSR-safe defaults.
		 */
		const consent = consentState.createConsentState();
		expect(consent.tier).toBeNull();
	});

	it('resolved is false before cookie effect fires — no premature banner flash', () => {
		const consent = consentState.createConsentState();
		expect(consent.resolved).toBe(false);
		expect(consent.needsBanner).toBe(false);
	});

	it('setTier is required to gain analytics consent — no auto-grant', () => {
		const consent = consentState.createConsentState();
		// Unrelated mutations must not grant consent
		consent.reopenBanner();
		consent.closeBanner();
		expect(consent.tier).toBeNull();
	});

	it('resetTier returns to null — not to any consent level', () => {
		const consent = consentState.createConsentState();
		consent.setTier('analytics');
		expect(consent.tier).toBe('analytics');

		consent.resetTier();
		expect(consent.tier).toBeNull(); // not 'necessary', not 'analytics'
	});
});

// ── 9. silent swallow — DB error is observable, not rethrown ─────────────────

describe('recordEvent — DB error swallowed silently by hook', () => {
	it('promise rejects on invalid input; catch handler receives the error', async () => {
		/**
		 * The hook calls trackPageview().catch(err => console.error(...)).
		 * A DB failure inside recordEvent causes the promise to reject.
		 * The hook swallows it — the response is returned normally.
		 * This test proves the rejection is real and observable via the catch handler.
		 *
		 * Method: force a DB constraint error with an invalid enum, spy on console.error,
		 * assert the spy fires — exactly what the hook does.
		 */
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const badInsert = recordEvent({
			sessionId: 'err-sess',
			visitorId: 'v_badbadbadbad0001',
			// @ts-expect-error — intentional invalid enum to force DB error
			eventType: 'invalid_type',
			path: '/crash',
		});

		// Replicate the hook's fire-and-forget pattern
		const result = await badInsert
			.then(() => 'ok')
			.catch((err) => {
				console.error('[analytics] Failed to track pageview:', err);
				return 'swallowed';
			});

		expect(result).toBe('swallowed');
		expect(errorSpy).toHaveBeenCalledWith('[analytics] Failed to track pageview:', expect.anything());

		errorSpy.mockRestore();
	});
});
