/**
 * Universal search engine (client).
 *
 * Lane A (instant): matches a lazy-fetched per-locale shard in-browser — zero
 * network per keystroke, immune to DB cold-start. Lane B (debounced): hits
 * `GET /api/search` for full-body docs + live blog, aborting stale requests.
 *
 * Paths in the shard are locale-bare; consumers localize hrefs at render.
 */

import type { Locale } from '$lib/i18n';
import { match } from '$lib/search/match';
import type { SearchRecord, SearchResult } from '$lib/search/types';

export type SearchStatus = 'idle' | 'loading' | 'done' | 'error';

export function createSearchEngine() {
	let query = $state('');
	let locale = $state<Locale>('en');
	let records = $state.raw<SearchRecord[]>([]);
	let asyncResults = $state.raw<SearchResult[]>([]);
	let status = $state<SearchStatus>('idle');

	let shardLocale: string | null = null;
	let controller: AbortController | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;

	const instant = $derived(query.trim().length > 0 ? match(records, query, 24) : []);

	async function loadShard(loc: Locale) {
		if (shardLocale === loc) return;
		shardLocale = loc;
		try {
			const res = await fetch(`/api/search-index/${loc}`);
			if (res.ok) records = await res.json();
		} catch {
			/* shard fetch failed → instant lane stays empty; server lane still works */
		}
	}

	function runAsync(q: string) {
		controller?.abort();
		controller = new AbortController();
		status = 'loading';
		fetch(`/api/search?q=${encodeURIComponent(q)}&locale=${locale}`, { signal: controller.signal })
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
			.then((body) => {
				asyncResults = body?.data?.items ?? [];
				status = 'done';
			})
			.catch((err: unknown) => {
				if ((err as { name?: string })?.name === 'AbortError') return;
				asyncResults = [];
				status = 'error';
			});
	}

	return {
		get instant() {
			return instant;
		},
		get async() {
			return asyncResults;
		},
		get status() {
			return status;
		},
		/** Prefetch the shard (e.g. on first palette open). */
		ensureLoaded() {
			void loadShard(locale);
		},
		setLocale(loc: Locale) {
			locale = loc;
			void loadShard(loc);
		},
		setQuery(q: string) {
			query = q;
			void loadShard(locale);
			if (timer) clearTimeout(timer);
			if (!q.trim()) {
				controller?.abort();
				asyncResults = [];
				status = 'idle';
				return;
			}
			timer = setTimeout(() => runAsync(q), 300);
		},
		reset() {
			query = '';
			asyncResults = [];
			status = 'idle';
			controller?.abort();
			if (timer) clearTimeout(timer);
		},
	};
}

export type SearchEngine = ReturnType<typeof createSearchEngine>;
