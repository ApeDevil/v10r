/**
 * Intent-based preloading — start the next navigation before it is asked for.
 *
 * A link the user is about to follow is a signal, and SvelteKit will act on it: the
 * app-wide default is `data-sveltekit-preload-data="hover"` on `<body>` (see
 * `app.html`), which fetches a route's data on hover or touch. This module is the
 * policy layer over that default, for the two cases the blanket setting gets wrong.
 *
 *   TOO EAGER. Hover-preloading a route whose load is expensive — a report, an AI
 *   call, anything that writes — spends real backend work on a guess. Those links
 *   take `code`, which fetches the JavaScript and nothing else, or `off`.
 *
 *   TOO LATE. When the current screen strongly predicts the next one, waiting for a
 *   hover wastes the idle time in between. `preloadOnIdle` spends it instead, after
 *   the page is interactive.
 *
 * Three invariants, and the first one is the whole contract:
 *
 *   Preloading is never required for correctness. Every function here swallows its
 *   failures — a speculative load that throws must be indistinguishable from one that
 *   never ran, or a warm cache becomes load-bearing and the cold path rots unnoticed.
 *
 *   Speculation is cancellable or harmless. Nothing here mutates.
 *
 *   Nothing expensive fires from mere visibility. `viewport` is deliberately absent
 *   from the intents that fetch data: on a page of forty links it would fetch forty
 *   route loads for a user who scrolled past.
 */
import { preloadCode, preloadData } from '$app/navigation';

/**
 * How much to speculate for a link.
 *
 * `code` is cheap and safe — a JS chunk from the CDN, no server work. `data` runs the
 * route's real `load`, which is why it is reserved for links whose cost is small or
 * whose probability is high.
 */
export type PreloadIntent = 'none' | 'code' | 'data' | 'code-data' | 'idle';

/** SvelteKit's own attribute vocabulary, kept out of call sites. */
const DATA_TRIGGER: Record<PreloadIntent, 'off' | 'hover' | 'tap' | 'viewport'> = {
	none: 'off',
	code: 'off',
	data: 'hover',
	// Both halves: `viewport` warms the code as the link scrolls in, `tap` holds the
	// data fetch back until the pointer actually goes down on it.
	'code-data': 'tap',
	idle: 'off',
};

const CODE_TRIGGER: Record<PreloadIntent, 'off' | 'hover' | 'tap' | 'viewport' | 'eager'> = {
	none: 'off',
	code: 'viewport',
	data: 'hover',
	'code-data': 'viewport',
	idle: 'off',
};

/**
 * Attributes to spread onto an anchor.
 *
 * ```svelte
 * <a href="/reports/heavy" {...preloadAttributes('code')}>Report</a>
 * ```
 */
export function preloadAttributes(intent: PreloadIntent): Record<string, string> {
	return {
		'data-sveltekit-preload-data': DATA_TRIGGER[intent],
		'data-sveltekit-preload-code': CODE_TRIGGER[intent],
	};
}

/**
 * Preload `href` now, at the given level.
 *
 * For the case no attribute can express: the app knows what comes next — a wizard's
 * following step, the row a keyboard selection has landed on — and there is no hover
 * to wait for.
 */
export async function preloadNow(href: string, intent: PreloadIntent = 'code-data'): Promise<void> {
	if (intent === 'none') return;
	try {
		if (intent === 'code') {
			await preloadCode(href);
			return;
		}
		// preloadData loads the code too, so `code-data` and `idle` need no second call.
		await preloadData(href);
	} catch {
		// Deliberately silent. A failed guess is not an error the user did anything to
		// cause, and logging one per unfollowed link would drown the console.
	}
}

/**
 * Preload once the browser is idle, and only then.
 *
 * Returns a cancel function — call it on unmount, or a navigation away leaves work
 * scheduled for a page that no longer exists.
 */
export function preloadOnIdle(href: string, intent: PreloadIntent = 'code'): () => void {
	if (intent === 'none' || typeof window === 'undefined') return () => {};

	// requestIdleCallback is still missing in Safari; the timeout fallback is late
	// rather than never, which is the right failure for work nobody is waiting on.
	const idle = window.requestIdleCallback;
	if (typeof idle === 'function') {
		const handle = idle(() => void preloadNow(href, intent), { timeout: 3000 });
		return () => window.cancelIdleCallback?.(handle);
	}
	const handle = window.setTimeout(() => void preloadNow(href, intent), 1500);
	return () => window.clearTimeout(handle);
}
