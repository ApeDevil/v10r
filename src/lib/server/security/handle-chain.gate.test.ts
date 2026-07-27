/**
 * HANDLE CHAIN ORDER GATE.
 *
 * Ordering in `sequence()` is load-bearing security, and nothing asserted it.
 * Some of it is subtle enough to be re-broken by a well-meaning refactor:
 *
 *  - `securityHeaders` must stay first: it stamps `locals.clientIp` from
 *    `getClientAddress()`, and every limiter downstream keys off that. Move it
 *    and the IP becomes attacker-influenced.
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
	'securityHeaders',
	'stripBaseLocalePrefix',
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
		expect(chainOrder()[0]).toBe('securityHeaders');
	});

	it('populates the session before the guards that read it', () => {
		const order = chainOrder();
		expect(order.indexOf('sessionPopulate')).toBeLessThan(order.indexOf('devRouteGuard'));
		expect(order.indexOf('sessionPopulate')).toBeLessThan(order.indexOf('analyticsCollector'));
	});
});
