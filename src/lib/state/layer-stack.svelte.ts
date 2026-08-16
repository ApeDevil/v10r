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
 * Layers also carry their OWNER CHAIN — the ids of the layers they were opened
 * from, outermost first, collected through Svelte context (`setLayerScope` /
 * `getLayerScope`). A layer that watches the stack to yield to whatever covers
 * it (the mobile sidebar drawer) must not yield to its own menus, and the
 * component tree — not the DOM, which portals scatter — is what says whose menu
 * it is. Same context-through-portal fact `$lib/styles/elevation` relies on.
 *
 * The chain is captured at push time rather than walked on demand: an
 * intermediate ancestor can close while its descendant stays open (the user
 * menu closes as its sign-out confirm opens), and a walk would then lose the
 * trail back to the drawer.
 *
 * Mutators untrack their own reads: callers register from inside $effect, and a
 * tracked read of #layers there would make the effect re-run on its own write
 * (effect_update_depth_exceeded). They also no-op when nothing changes, so
 * subscribers of isTop/depth/top are not signalled spuriously.
 */

import { getContext, setContext, untrack } from 'svelte';

const LAYER_SCOPE = Symbol('layer-scope');

/**
 * The chain of layers enclosing this position in the component tree, outermost
 * first (empty at the root). Call at component init and pass the result to
 * `push` — `getContext` is init-only, so it cannot be read from inside $effect.
 */
export function getLayerScope(): readonly string[] {
	return getContext<readonly string[]>(LAYER_SCOPE) ?? [];
}

/**
 * Declare `id` as the owning layer for everything rendered below, composing with
 * any enclosing scope. Returns the new chain — pass it when pushing a layer that
 * this component opens on its own behalf (a submenu panel) rather than a child.
 */
export function setLayerScope(id: string): readonly string[] {
	const chain = [...getLayerScope(), id];
	setContext(LAYER_SCOPE, chain);
	return chain;
}

interface Layer {
	id: string;
	/** Enclosing layer ids, outermost first — see `getLayerScope`. */
	scope: readonly string[];
}

class LayerStack {
	#layers = $state<Layer[]>([]);

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

	/** Register a layer as the new top. Idempotent — re-pushing an id moves it to the top.
	 * `scope` is the enclosing layer chain from `getLayerScope()`; omit for a root layer. */
	push(id: string, scope: readonly string[] = []): void {
		untrack(() => {
			const layers = this.#layers;
			if (layers[layers.length - 1]?.id === id) return;
			this.#layers = [...layers.filter((l) => l.id !== id), { id, scope }];
		});
	}

	/** Unregister a layer wherever it sits (layers can close out of order). */
	pop(id: string): void {
		untrack(() => {
			if (!this.#layers.some((l) => l.id === id)) return;
			this.#layers = this.#layers.filter((l) => l.id !== id);
		});
	}

	/** True when `id` is the top-most registered layer, or when nothing is registered
	 * above it (an unregistered stack means the caller is effectively on top). */
	isTop(id: string): boolean {
		const layers = this.#layers;
		return layers.length === 0 || layers[layers.length - 1]?.id === id;
	}

	/** True when nothing FOREIGN covers `id`: the top layer is `id` itself, or was opened
	 * from within it (any depth). Use this — not `isTop` — to decide whether to yield to a
	 * competing surface, so a layer does not dismiss itself when its own menu opens.
	 * Mirrors `isTop`'s empty-stack semantics. */
	ownsTop(id: string): boolean {
		const layers = this.#layers;
		const top = layers[layers.length - 1];
		if (!top) return true;
		return top.id === id || top.scope.includes(id);
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
		return this.#layers[this.#layers.length - 1]?.id ?? null;
	}
}

/** The one layer stack for this tab. */
export const layerStack = new LayerStack();
