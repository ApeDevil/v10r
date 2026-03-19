/**
 * Style randomizer state management (SSR-safe using context pattern).
 * Follows the same pattern as theme.svelte.ts.
 */

import { getContext, setContext } from 'svelte';
import { browser } from '$app/environment';
import type { ResolvedStyle } from '$lib/styles/random/types';

const STYLE_CTX = Symbol('style');

export function createStyleState(initial: ResolvedStyle) {
	let current = $state<ResolvedStyle>({ ...initial });
	let rolling = $state(false);
	let rollCount = $state(0);
	let announcement = $state('');

	// Sync data-palette, data-typography, and data-radius attributes to <html> when style changes
	$effect(() => {
		if (!browser) return;
		document.documentElement.dataset.palette = current.paletteId;
		document.documentElement.dataset.typography = current.typographyId;
		document.documentElement.dataset.radius = current.radiusId;
	});

	return {
		get paletteId() {
			return current.paletteId;
		},
		get typographyId() {
			return current.typographyId;
		},
		get radiusId() {
			return current.radiusId;
		},
		get paletteName() {
			return current.paletteName;
		},
		get typographyName() {
			return current.typographyName;
		},
		get radiusName() {
			return current.radiusName;
		},
		get corporate() {
			return current.corporate ?? false;
		},
		get rolling() {
			return rolling;
		},
		get rollCount() {
			return rollCount;
		},
		get announcement() {
			return announcement;
		},

		/** Update from server data (e.g. after navigation) */
		update(style: ResolvedStyle) {
			current = { ...style };
		},

		/** Roll a new random style via API */
		async roll(toast?: { info: (msg: string, duration?: number) => void }) {
			if (rolling || current.corporate) return;
			rolling = true;

			try {
				const res = await fetch('/api/style/roll', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-Requested-With': 'sveltekit',
					},
					body: JSON.stringify({}),
				});

				if (!res.ok) {
					toast?.info('Could not shuffle style', 4000);
					return;
				}

				const data = await res.json();

				// Same style rolled — skip
				if (
					data.style.paletteId === current.paletteId &&
					data.style.typographyId === current.typographyId &&
					data.style.radiusId === current.radiusId
				) {
					toast?.info('Same one — try again', 3000);
					return;
				}

				// Apply directly — the $effect syncs data attributes to <html>, CSS cascade does the rest
				current = { ...data.style };
				rollCount++;
				announcement = `Style changed to ${data.style.paletteName} palette with ${data.style.typographyName} typography`;
				toast?.info(`${data.style.paletteName} · ${data.style.typographyName}`, 4000);
			} finally {
				rolling = false;
			}
		},
	};
}

export function setStyleContext(initial: ResolvedStyle) {
	const style = createStyleState(initial);
	setContext(STYLE_CTX, style);
	return style;
}

export function getStyle() {
	return getContext<ReturnType<typeof createStyleState>>(STYLE_CTX);
}
