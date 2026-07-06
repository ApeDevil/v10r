/**
 * Layer stack — shared dismissal order for stacked floating UIs.
 *
 * Every dismissible floating layer (drawer, menu, modal, flyout) registers on
 * open and unregisters on close. Hand-rolled Escape/outside-click handlers must
 * guard with `wasTop(id)` so one keypress peels exactly one layer instead of
 * collapsing the whole pile (Bits UI layers handle their own dismissal; they
 * register so layers *underneath* know they are not on top).
 *
 * Never register: tooltips (no dismiss lifecycle), the consent banner (must not
 * be Escape-dismissible), toasts, and the desktop chatbot dock (persistent
 * workspace panel).
 *
 * Module singleton — portaled layers live outside any component subtree, so
 * context would not reach them (precedent: chatbot-session.svelte.ts).
 *
 * Mutators untrack their own reads: callers register from inside $effect, and a
 * tracked read of #layers there would make the effect re-run on its own write
 * (effect_update_depth_exceeded). They also no-op when nothing changes, so
 * subscribers of isTop/depth/top are not signalled spuriously.
 */

import { untrack } from 'svelte';

class LayerStack {
	#layers = $state<string[]>([]);

	/** Top layer at the moment the current interaction began (`undefined` = no
	 * interaction recorded yet, `null` = stack was empty). Bits UI dismisses on
	 * document-capture and flushes synchronously, so by the time a hand-rolled
	 * window/bubble handler runs, the covering layer has already popped and
	 * `isTop` lies. Window capture fires before document capture — snapshot there. */
	#topAtEventStart: string | null | undefined = undefined;

	constructor() {
		if (typeof window !== 'undefined') {
			const record = () => {
				this.#topAtEventStart = untrack(() => this.top);
			};
			window.addEventListener('keydown', record, true);
			window.addEventListener('pointerdown', record, true);
		}
	}

	/** Register a layer as the new top. Idempotent — re-pushing an id moves it to the top. */
	push(id: string): void {
		untrack(() => {
			const layers = this.#layers;
			if (layers[layers.length - 1] === id) return;
			this.#layers = [...layers.filter((l) => l !== id), id];
		});
	}

	/** Unregister a layer wherever it sits (layers can close out of order). */
	pop(id: string): void {
		untrack(() => {
			if (!this.#layers.includes(id)) return;
			this.#layers = this.#layers.filter((l) => l !== id);
		});
	}

	/** True when `id` is the top-most registered layer, or when nothing is registered
	 * above it (an unregistered stack means the caller is effectively on top). */
	isTop(id: string): boolean {
		const layers = this.#layers;
		return layers.length === 0 || layers[layers.length - 1] === id;
	}

	/** True when `id` was the top layer as the current interaction started — use this
	 * (not `isTop`) in Escape/outside-click guards: a Bits layer stacked above may have
	 * closed itself synchronously earlier in the same event, or on the pointerdown that
	 * precedes this click. Mirrors `isTop`'s empty-stack semantics. */
	wasTop(id: string): boolean {
		if (this.#topAtEventStart === undefined) return this.isTop(id);
		return this.#topAtEventStart === null || this.#topAtEventStart === id;
	}

	get depth(): number {
		return this.#layers.length;
	}

	get top(): string | null {
		return this.#layers[this.#layers.length - 1] ?? null;
	}
}

/** The one layer stack for this tab. */
export const layerStack = new LayerStack();
