import { browser } from '$app/environment';

export interface ScrollSpyOptions {
	/** IntersectionObserver rootMargin. The default biases the "active" band to the
	 *  upper third of the viewport so a heading counts as current once it is read,
	 *  not once it is fully scrolled past. */
	rootMargin?: string;
}

export interface ScrollSpy {
	/** Id of the section currently considered active. */
	readonly current: string;
}

const DEFAULT_ROOT_MARGIN = '-100px 0px -66% 0px';

/**
 * Tracks which of a set of anchor ids is currently in view.
 *
 * Must be called during component initialisation — it registers an `$effect`.
 * `getIds` is read reactively, so a locale switch or a re-derived section list
 * re-registers the observer against the new anchors.
 *
 * Until the observer first fires, the first id is reported as active, which is
 * what a reader sees at the top of the page.
 */
export function createScrollSpy(getIds: () => string[], options?: ScrollSpyOptions): ScrollSpy {
	let observed = $state('');

	$effect(() => {
		if (!browser) return;

		const ids = getIds();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) observed = entry.target.id;
				}
			},
			{ rootMargin: options?.rootMargin ?? DEFAULT_ROOT_MARGIN, threshold: 0 },
		);

		for (const id of ids) {
			const el = document.getElementById(id);
			if (el) observer.observe(el);
		}

		return () => observer.disconnect();
	});

	// Fall back to the first anchor until the observer reports one, and whenever the
	// observed id is no longer part of the current list (e.g. the page swapped docs).
	const current = $derived.by(() => {
		const ids = getIds();
		return ids.includes(observed) ? observed : (ids[0] ?? '');
	});

	return {
		get current() {
			return current;
		},
	};
}
