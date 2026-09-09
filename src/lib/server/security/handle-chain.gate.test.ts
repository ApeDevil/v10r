/**
 * HANDLE CHAIN ORDER GATE.
 *
 * Ordering in `sequence()` is load-bearing security, and nothing asserted it.
 * Some of it is subtle enough to be re-broken by a well-meaning refactor:
 *
 *  - `securityHeaders` must stay above everything that could consume an identity:
 *    it stamps `locals.clientIp` from `getClientAddress()`, and every limiter
 *    downstream keys off that. Move it and the IP becomes attacker-influenced.
 *    `requestTiming`, `requestDeadline` and `queryCensus` are the only handlers
 *    allowed above it — each wraps the chain so its measure (total time, latency
 *    budget, round trips) covers the whole request, and none reads anything
 *    request-derived until AFTER `resolve`, by which point `securityHeaders` has
 *    long since run.
 *  - `bodySizeFloor` must stay ABOVE `authHandler`. `svelteKitHandler` answers
 *    `/api/auth/*` without calling `resolve`, so anything below it never sees
 *    that plane — placing the floor lower would leave sign-up and sign-in bodies
 *    unbounded, which is the one pre-auth surface most worth bounding.
 *  - `stripBaseLocalePrefix` runs before any auth, so it is the one handler that
 *    can emit a redirect to an unauthenticated caller — which is precisely how
 *    the `/en//evil.com` open redirect was reachable.
 *  - `authHandler` TERMINATES `/api/auth/*` (svelteKitHandler answers without
 *    calling resolve), so everything after it never runs for that plane. That
 *    is why removing `/api/auth/` from the CSRF exempt list would be a no-op,
 *    and why the Better Auth admin plugin sat outside every guard.
 *  - `sessionPopulate` must precede anything reading `locals.user`.
 *
 * This is a snapshot, not a rule engine: reordering is allowed, but it has to
 * be a deliberate diff someone reviews rather than an accident.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const HOOKS = join(process.cwd(), 'src', 'hooks.server.ts');

function chainOrder(): string[] {
	const source = readFileSync(HOOKS, 'utf8');
	const match = source.match(/export const handle = sequence\(([\s\S]*?)\);/);
	if (!match) throw new Error('Could not find the sequence() call in hooks.server.ts');
	return match[1]
		.split(',')
		.map((s) => s.replace(/\/\/.*$/gm, '').trim())
		.filter(Boolean);
}

const EXPECTED = [
	'requestTiming',
	'requestDeadline',
	'queryCensus',
	'securityHeaders',
	'bodySizeFloor',
	'stripBaseLocalePrefix',
	'docsMarkdown',
	'loadStyle',
	'i18n',
	'authCaptchaGate',
	'authHandler',
	'csrfProtection',
	'sessionPopulate',
	'consentLoader',
	'debugOwnerLoader',
	'devRouteGuard',
	'analyticsCollector',
];

describe('handle chain', () => {
	it('matches the reviewed order', () => {
		expect(chainOrder()).toEqual(EXPECTED);
	});

	it('stamps the client IP before anything that could consume it', () => {
		const order = chainOrder();
		// Not "index 0" any more, but the invariant is unchanged: nothing that reads
		// an identity may run above the stamp. The exceptions are asserted BY NAME so a
		// fourth handler cannot slip in on the back of a relaxed rule — and all three
		// qualify for the same reason: they stamp a request-scoped recorder and read
		// nothing from the request to do it.
		expect(order.slice(0, order.indexOf('securityHeaders'))).toEqual([
			'requestTiming',
			'requestDeadline',
			'queryCensus',
		]);
	});

	// The tracer must wrap the chain, or `total` measures a subset of the request
	// and every "unattributed" figure derived from it is understated.
	it('measures the whole request', () => {
		expect(chainOrder()[0]).toBe('requestTiming');
	});

	// Same argument for the budget: a deadline that starts partway down the chain
	// bounds a subset of the request, so every child slice taken from it is wrong in
	// the one direction that matters — too generous.
	it('starts the latency budget at the edge', () => {
		const order = chainOrder();
		expect(order.indexOf('requestDeadline')).toBeLessThan(order.indexOf('securityHeaders'));
	});

	// The census must wrap the session lookup, not sit below it. Auth is the request's
	// least visible query — nobody writes it, so nobody counts it — and a counter that
	// starts after it reports every request as cheaper than it was.
	it('counts the queries authentication makes', () => {
		const order = chainOrder();
		expect(order.indexOf('queryCensus')).toBeLessThan(order.indexOf('authHandler'));
		expect(order.indexOf('queryCensus')).toBeLessThan(order.indexOf('sessionPopulate'));
	});

	it('populates the session before the guards that read it', () => {
		const order = chainOrder();
		expect(order.indexOf('sessionPopulate')).toBeLessThan(order.indexOf('devRouteGuard'));
		expect(order.indexOf('sessionPopulate')).toBeLessThan(order.indexOf('analyticsCollector'));
	});

	// A Set-Cookie from i18n (PARAGLIDE_LOCALE) or loadStyle (style cookie) on a
	// markdown response would silently void `s-maxage` on every shared cache — no
	// test failure, just a cost. The .md layer must short-circuit above both.
	it('serves markdown above the cookie-writing handlers', () => {
		const order = chainOrder();
		expect(order.indexOf('docsMarkdown')).toBeLessThan(order.indexOf('loadStyle'));
		expect(order.indexOf('docsMarkdown')).toBeLessThan(order.indexOf('i18n'));
	});
});
