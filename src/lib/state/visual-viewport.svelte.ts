/**
 * Virtual-keyboard watcher — ONE per tab (the visual viewport is a tab
 * resource, not a component resource; "singleton-ness follows the resource",
 * unlike per-dock state which must be context-scoped).
 *
 * Publishes to CSS rather than to components: writes `--keyboard-inset` and
 * `data-keyboard="open|closed"` onto <html>, so consumers stay pure CSS
 * (`:root[data-keyboard='open'] .fab-keyboard-hide { display: none }`) with
 * zero per-component reactivity. Reactive getters exist for the rare JS
 * consumer.
 *
 * Detection: inset = innerHeight − (visualViewport.height + offsetTop),
 * rAF-coalesced across 'resize' AND 'scroll' (iOS reports keyboard geometry
 * as offsetTop changes during the animation). Hysteresis 150/100px clears
 * browser-chrome artifacts (iOS bottom toolbar ~44–56px; the iOS 26
 * residual-height bug ~24px, still open in Chrome/Edge-iOS) while any real
 * soft keyboard (~250px+) trips it. NEVER reposition UI from these numbers —
 * hide-and-vacate only; a repositioner inherits every browser drift bug.
 */

import { browser } from '$app/environment';

const OPEN_THRESHOLD = 150;
const CLOSE_THRESHOLD = 100;

/** Pure hysteresis step — node-testable. */
export function computeKeyboardState(rawInset: number, wasOpen: boolean): { inset: number; open: boolean } {
	const inset = Math.max(0, Math.round(rawInset));
	const open = wasOpen ? inset > CLOSE_THRESHOLD : inset > OPEN_THRESHOLD;
	return { inset: open ? inset : 0, open };
}

class VisualViewportWatcher {
	#inset = $state(0);
	#open = $state(false);
	#raf = 0;
	#detach: (() => void) | null = null;

	/** Occluded pixels at the viewport bottom (0 while closed). */
	get keyboardInset(): number {
		return this.#inset;
	}

	get keyboardOpen(): boolean {
		return this.#open;
	}

	#publish(): void {
		const el = document.documentElement;
		el.style.setProperty('--keyboard-inset', `${this.#inset}px`);
		el.dataset.keyboard = this.#open ? 'open' : 'closed';
	}

	#measure = (): void => {
		this.#raf = 0;
		const vv = window.visualViewport;
		if (!vv) return;
		const raw = window.innerHeight - (vv.height + vv.offsetTop);
		const next = computeKeyboardState(raw, this.#open);
		if (next.inset === this.#inset && next.open === this.#open) return;
		this.#inset = next.inset;
		this.#open = next.open;
		this.#publish();
	};

	#schedule = (): void => {
		if (this.#raf) return;
		this.#raf = requestAnimationFrame(this.#measure);
	};

	/**
	 * Attach listeners. Idempotent; returns the detach function. Called from
	 * ONE $effect in the root layout — the singleton never self-attaches, so
	 * SSR and the node test env see a dormant object reporting 0/false.
	 */
	attach(): () => void {
		if (!browser || !window.visualViewport) return () => {};
		if (this.#detach) return this.#detach;
		const vv = window.visualViewport;
		vv.addEventListener('resize', this.#schedule);
		vv.addEventListener('scroll', this.#schedule);
		window.addEventListener('resize', this.#schedule);
		window.addEventListener('orientationchange', this.#schedule);
		this.#measure();
		this.#detach = () => {
			vv.removeEventListener('resize', this.#schedule);
			vv.removeEventListener('scroll', this.#schedule);
			window.removeEventListener('resize', this.#schedule);
			window.removeEventListener('orientationchange', this.#schedule);
			if (this.#raf) cancelAnimationFrame(this.#raf);
			this.#raf = 0;
			this.#inset = 0;
			this.#open = false;
			this.#publish();
			this.#detach = null;
		};
		return this.#detach;
	}
}

export const visualViewportWatcher = new VisualViewportWatcher();
