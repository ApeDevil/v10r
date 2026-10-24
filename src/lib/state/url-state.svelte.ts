/**
 * URL state bound to the SvelteKit router. Two write modes, and choosing between them is the
 * whole decision (`docs/blueprint/state.md#url-state`):
 *
 * - `navigate` — the param is data a `load` reads (a filter, a page, a range). Values come
 *   from `page.url`; a write is `goto(…, { replace, reset: false })` (scroll and focus stay
 *   put), so the load re-runs and `page.url` stays the truth.
 * - `shallow` — the param is view state no load reads (a selected part, an open tab). Values
 *   live in local `$state`, seeded from the URL; a write is `goto(…, { shallow: true })`: no
 *   load, navigation hooks see `shallow` and stand aside, and `page.url` keeps the URL the
 *   page loaded with, so read the values here, never from `page.url`.
 *
 * Never `history.replaceState`/`pushState` directly: the router stores its own entry state in
 * history, and a raw write replaces it with whatever the caller passes.
 *
 * Call `createUrlState` during component initialisation — it reads `page`, which is
 * per-request on the server, so there is no module state to leak between users. Never `set`
 * during initialisation: the router does not take a history write before it has started, and
 * on the server there is no history at all — the URL already holds the initial values.
 */
import { browser } from '$app/env';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { readUrlState, type UrlStateSpec, type UrlStateValues, urlStateHref, writeUrlState } from './url-state';

export interface UrlStateOptions {
	write: 'navigate' | 'shallow';
	/** Collapse a burst of writes (typing in a search box) into one; 0 writes at once. */
	debounceMs?: number;
	/** `navigate` only: add a history entry instead of replacing the current one. */
	history?: 'replace' | 'push';
}

export interface UrlState<S extends UrlStateSpec> {
	/** The current values — including a write still waiting out its debounce. */
	readonly values: UrlStateValues<S>;
	set(patch: Partial<UrlStateValues<S>>): void;
	/** A link to this page with `patch` applied — for `<a href>`, which needs no write at all. */
	href(patch: Partial<UrlStateValues<S>>): string;
}

export function createUrlState<S extends UrlStateSpec>(spec: S, options: UrlStateOptions): UrlState<S> {
	const debounceMs = options.debounceMs ?? 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

	// navigate: what is still waiting to be written; shallow: the values themselves.
	let pending = $state<Partial<UrlStateValues<S>>>({});
	// Shallow writes live in the address bar, not in page.url: on Back, SvelteKit restores the
	// entry's loaded URL while the bar keeps the shallow params, so seed from the bar.
	let local = $state(readUrlState((browser ? new URL(window.location.href) : page.url).searchParams, spec));

	// A write still waiting out its debounce must not land on the next page's URL.
	$effect(() => () => clearTimeout(timer));

	// A getter rather than `$derived`: it reads `page.url` and the state above on every access,
	// so it tracks in components and stays correct where runes compile for the server.
	const current = (): UrlStateValues<S> =>
		options.write === 'navigate' ? { ...readUrlState(page.url.searchParams, spec), ...pending } : local;

	function schedule(write: () => void): void {
		clearTimeout(timer);
		if (debounceMs > 0) timer = setTimeout(write, debounceMs);
		else write();
	}

	function navigate(): void {
		const written = pending;
		void goto(writeUrlState(page.url, spec, written), {
			replace: options.history !== 'push',
			reset: false,
		}).then(settle, settle);
		function settle() {
			// A newer write may have arrived while this one navigated; keep it. A navigation that
			// failed or was superseded leaves page.url as it is, so the pending patch goes too.
			if (pending === written) pending = {};
		}
	}

	function shallow(): void {
		if (!browser) return;
		// page.url is the URL the page loaded with under shallow routing; the address bar is the
		// one carrying earlier shallow writes, so build on it.
		void goto(writeUrlState(new URL(window.location.href), spec, local), {
			shallow: true,
			replace: true,
			state: page.state,
		});
	}

	return {
		get values() {
			return current();
		},
		set(patch) {
			if (options.write === 'navigate') {
				pending = { ...pending, ...patch };
				schedule(navigate);
			} else {
				local = { ...local, ...patch };
				schedule(shallow);
			}
		},
		href(patch) {
			return urlStateHref(page.url, spec, { ...current(), ...patch });
		},
	};
}
