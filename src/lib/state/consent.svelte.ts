/**
 * Consent state management (SSR-safe using context pattern)
 * Follows the same pattern as theme.svelte.ts — cookie-backed, context-scoped.
 */

import { getContext, setContext } from 'svelte';
import { browser } from '$app/environment';
import { getCookie, setCookie } from '$lib/utils/cookies';

export type ConsentTier = 'necessary' | 'analytics';

const CONSENT_CTX = Symbol('consent');
const COOKIE_NAME = 'v10r_consent';
const COOKIE_MAX_AGE = 15_552_000; // 6 months in seconds

/**
 * Create consent state instance.
 * Reads existing cookie on mount, exposes tier + banner visibility.
 */
export function createConsentState() {
	let tier = $state<ConsentTier | null>(null);
	let resolved = $state(false);
	let bannerOpen = $state(false);

	// Read cookie on client (mirrors theme.svelte.ts pattern)
	$effect(() => {
		if (!browser) return;
		const raw = getCookie(COOKIE_NAME);
		// An unrecognised value (including the retired `full`) leaves tier null, so
		// the banner reappears and the visitor is asked against the current
		// description of the processing rather than a stale one.
		if (raw === 'necessary' || raw === 'analytics') {
			tier = raw;
		}
		resolved = true;
	});

	const needsBanner = $derived(resolved && tier === null);

	return {
		get tier() {
			return tier;
		},
		get resolved() {
			return resolved;
		},
		get needsBanner() {
			return needsBanner;
		},
		get bannerOpen() {
			return bannerOpen;
		},

		setTier(newTier: ConsentTier) {
			tier = newTier;
			if (browser) {
				setCookie(COOKIE_NAME, newTier, { maxAge: COOKIE_MAX_AGE, secure: true });
			}
		},

		reopenBanner() {
			bannerOpen = true;
		},

		closeBanner() {
			bannerOpen = false;
		},

		/** Clear cookie and reset to first-visit state (banner will auto-show) */
		resetTier() {
			tier = null;
			if (browser) {
				setCookie(COOKIE_NAME, '', { maxAge: 0, secure: true });
			}
		},
	};
}

/**
 * Set consent context in component tree.
 * Call this in root layout alongside other contexts.
 */
export function setConsentContext() {
	const consent = createConsentState();
	setContext(CONSENT_CTX, consent);
	return consent;
}

/**
 * Get consent state from context.
 * Use this in child components.
 */
export function getConsent() {
	return getContext<ReturnType<typeof createConsentState>>(CONSENT_CTX);
}
