/**
 * Style randomizer state management (SSR-safe using context pattern).
 * Follows the same pattern as theme.svelte.ts.
 */

import { getContext, setContext } from 'svelte';
import { browser } from '$app/environment';
import { apiFetch } from '$lib/api';
import type { ResolvedStyle } from '$lib/styles/random/types';

const STYLE_CTX = Symbol('style');

/**
 * A single dimension of a pick, with the display name the caller already has.
 *
 * Names are passed in rather than looked up here so this module never imports
 * PALETTE_REGISTRY — it is instantiated by the root layout on every page, and
 * the registry drags in ~500 lines of color data plus contrast validation at
 * import time. The picker that calls this already has the registry loaded.
 */
export type StylePick =
	| { paletteId: string; paletteName: string }
	| { typographyId: string; typographyName: string }
	| { radiusId: string; radiusName: string };

export function createStyleState(initial: ResolvedStyle) {
	let current = $state<ResolvedStyle>({ ...initial });
	let rolling = $state(false);
	let picking = $state(false);
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
		get rolling() {
			return rolling;
		},
		get picking() {
			return picking;
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
			if (rolling) return;
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

				const { data } = await res.json();

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

		/**
		 * Apply one specific choice, leaving the other two dimensions alone.
		 *
		 * Applied optimistically so the page repaints on click rather than after a
		 * round-trip, then reconciled with the server (which is authoritative — it
		 * resolves custom palette names we can't). On failure the previous style is
		 * restored: leaving the visual changed while the cookie did not would look
		 * fine until the next reload silently snapped it back.
		 */
		async pick(patch: StylePick, toast?: { info: (msg: string, duration?: number) => void }) {
			if (picking) return;
			const previous = { ...current };
			// The $effect below is the ONLY writer of the <html> data-* attributes;
			// mutating `current` is how a pick reaches the DOM. Cast because a custom
			// palette id (`CP_…`) is valid at runtime but outside the PaletteId union.
			current = { ...current, ...patch } as ResolvedStyle;
			picking = true;

			try {
				const res = await apiFetch('/api/style/pick', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(patch),
				});

				if (!res.ok) {
					current = previous;
					toast?.info('Could not save that pick', 4000);
					return;
				}

				const { data } = await res.json();
				current = { ...data.style };
				announcement = `Style changed to ${data.style.paletteName} palette with ${data.style.typographyName} typography`;
			} catch {
				current = previous;
				toast?.info('Could not save that pick', 4000);
			} finally {
				picking = false;
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
