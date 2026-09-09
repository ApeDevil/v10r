import { describe, expect, it } from 'vitest';
import { createConsentState } from './consent.svelte';

/**
 * Deny-by-default for the consent banner.
 *
 * `$effect` does not run in the node environment, so what is asserted here is the
 * SSR-safe synchronous initial state and the explicit transitions — which is exactly
 * the half that matters: the tier must start null and never become a consent level
 * except through `setTier`. The cookie effect that resolves it in the browser is
 * verified there, not here.
 *
 * This lived in `server/analytics/analytics.pglite.test.ts`, where it paid for a
 * PGlite instance it never touched and sat in a server suite despite testing a
 * browser module.
 */
describe('createConsentState — default is null, never auto-granted', () => {
	it('tier is null on initialisation — not necessary, analytics, or full', () => {
		/**
		 * In test/SSR context the $effect does not fire (no browser).
		 * Synchronous initial values represent the SSR-safe defaults.
		 */
		const consent = createConsentState();
		expect(consent.tier).toBeNull();
	});

	it('resolved is false before cookie effect fires — no premature banner flash', () => {
		const consent = createConsentState();
		expect(consent.resolved).toBe(false);
		expect(consent.needsBanner).toBe(false);
	});

	it('resetTier returns to null — not to any consent level', () => {
		const consent = createConsentState();
		consent.setTier('analytics');
		expect(consent.tier).toBe('analytics');

		consent.resetTier();
		expect(consent.tier).toBeNull(); // not 'necessary', not 'analytics'
	});
});
