/**
 * VERCEL WEB ANALYTICS — the third-party anonymous pageview lane.
 *
 * Runs ALONGSIDE the first-party lanes (`analytics/hook.ts` server pageviews +
 * `telemetry.ts` client signals), not instead of them. The two answer different
 * questions and neither replaces the other:
 *
 * - Vercel's lane is the cross-check. It sits in Vercel's own pipeline, so its
 *   traffic numbers are independent of our DB writes, our rate limiter, and our
 *   `waitUntil` deferral — when the first-party count and this one diverge, the
 *   divergence is itself the signal.
 * - The first-party lane is the deep one: engaged time, rage/dead clicks,
 *   scroll depth, Web Vitals with attribution, and a `visitor_id` we can honour
 *   an erasure request against. Vercel's has none of that and cannot: it
 *   discards its visitor hash after 24 hours, which is exactly why it is cheap
 *   to justify and useless for anything longitudinal.
 *
 * ## Consent
 *
 * Gated at the same tier as first-party client telemetry, and gated at BOTH
 * ends. Nothing is injected until consent is granted, so a visitor who never
 * accepts never fetches the script at all; and `beforeSend` re-reads the flag on
 * every event, so a mid-session withdrawal stops collection without a reload
 * (the script cannot be unloaded once injected — dropping at `beforeSend` is
 * the only mechanism that actually stops the beacon).
 *
 * Vercel Web Analytics sets no cookies and writes nothing to localStorage, so
 * it does not trigger TDDDG §25 / ePrivacy Art 5(3) on its own. It is gated
 * anyway: it hands page URLs and coarse geo to a third party, and the consent
 * banner's `analytics` tier is what our disclosure says covers that.
 *
 * ## Route exclusions
 *
 * `beforeSend` runs the SAME `isExcludedPath` policy as the first-party lanes.
 * Vercel's is an anonymous lane too, so `/admin`, `/account` and `/desk` are
 * barred from it for the same reason — in every locale.
 */

import { type BeforeSendEvent, injectAnalytics } from '@vercel/analytics/sveltekit';
import { browser, dev } from '$app/environment';
import { isExcludedPath } from './collect-policy';

/**
 * `injectAnalytics` is NOT idempotent. Its script-tag insertion is guarded, but
 * the `page` subscription it opens is not — calling it twice double-counts
 * every subsequent pageview. The layout effect that drives this can re-run.
 */
let injected = false;
let consentGranted = false;

/**
 * Drop anything the anonymous lane may not carry.
 *
 * Returning `null` suppresses the beacon entirely. `event.url` is an absolute
 * URL string; a parse failure is treated as a reason to drop rather than a
 * reason to guess.
 */
function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
	if (!consentGranted) return null;
	try {
		if (isExcludedPath(new URL(event.url).pathname)) return null;
	} catch {
		return null;
	}
	return event;
}

/**
 * Point collection at the visitor's current consent tier.
 *
 * Idempotent and safe to call from an effect on every change. Call it with the
 * same `analytics`-tier boolean that drives first-party telemetry, so the two
 * lanes can never disagree about what a visitor agreed to.
 */
export function setVercelAnalyticsConsent(granted: boolean): void {
	consentGranted = granted;
	if (!granted || injected || !browser) return;

	// Dev is deliberately inert. The production script and its beacons are
	// same-origin paths that only exist on a Vercel deployment (`/_vercel/
	// insights/*`, or the v2 build-seeded path) — locally they 404. The
	// `development` mode swaps in a cross-origin debug script from
	// va.vercel-scripts.com, which our CSP does not allow-list and which would
	// need an entry added to `script-src` before it could load at all. Verify
	// this lane on a preview deployment, where it is real.
	if (dev) return;

	injected = true;
	injectAnalytics({ mode: 'production', beforeSend });
}
