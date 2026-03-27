/**
 * Consent state management (SSR-safe using context pattern)
 * Follows the same pattern as theme.svelte.ts — cookie-backed, context-scoped.
 */

import { getContext, setContext } from 'svelte';
import { browser } from '$app/environment';

export type ConsentTier = 'necessary' | 'analytics' | 'full';

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
		const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
		if (match) {
			const raw = match[1];
			if (raw === 'necessary' || raw === 'analytics' || raw === 'full') {
				tier = raw;
			}
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
				document.cookie = `${COOKIE_NAME}=${newTier};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax;Secure`;
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
				document.cookie = `${COOKIE_NAME}=;path=/;max-age=0;SameSite=Lax;Secure`;
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
