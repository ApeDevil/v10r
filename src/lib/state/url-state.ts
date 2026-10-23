/**
 * URL state: search params read and written through one typed spec, on the server and in the
 * browser alike.
 *
 * A spec names each param and its codec. Reading never throws — the URL is user input, so a
 * value that does not parse becomes the param's fallback. Writing drops every param that
 * equals its fallback (one canonical URL per state, so shared links and caches agree) and
 * leaves params the spec does not name untouched. Framework-free: `+page.server.ts` parses
 * with it, and `url-state.svelte.ts` binds it to the router.
 */

/** One search param: how to read it, how to write it, and what it means when absent or invalid. */
export interface UrlParam<T> {
	readonly fallback: T;
	parse(raw: string | null): T;
	/** The string to put in the URL, or null to leave the param out. */
	serialize(value: T): string | null;
}

export type UrlStateSpec = Record<string, UrlParam<unknown>>;

export type UrlStateValues<S extends UrlStateSpec> = { [K in keyof S]: S[K] extends UrlParam<infer T> ? T : never };

const TEXT_MAX_LENGTH = 200;

/** The codecs a spec is built from. */
export const urlParam = {
	/** Free text, trimmed and capped; empty is the fallback. */
	text(fallback = '', maxLength = TEXT_MAX_LENGTH): UrlParam<string> {
		return {
			fallback,
			parse: (raw) => raw?.trim().slice(0, maxLength) || fallback,
			serialize: (value) => (value === fallback || value === '' ? null : value),
		};
	},

	/** An optional token (an id, a slug); absent means null. Validate membership where the set is known. */
	token(maxLength = TEXT_MAX_LENGTH): UrlParam<string | null> {
		return {
			fallback: null,
			parse: (raw) => (raw && raw.length <= maxLength && /^[\w.:-]+$/.test(raw) ? raw : null),
			serialize: (value) => value,
		};
	},

	/** One of a fixed set of values. */
	oneOf<const V extends string>(values: readonly V[], fallback: NoInfer<V>): UrlParam<V> {
		return {
			fallback,
			parse: (raw) => ((values as readonly string[]).includes(raw ?? '') ? (raw as V) : fallback),
			serialize: (value) => (value === fallback ? null : value),
		};
	},

	/** A whole number, clamped into [min, max]. */
	integer({
		fallback,
		min = Number.MIN_SAFE_INTEGER,
		max = Number.MAX_SAFE_INTEGER,
	}: IntegerOptions): UrlParam<number> {
		return {
			fallback,
			parse: (raw) => {
				if (raw === null || !/^-?\d+$/.test(raw)) return fallback;
				return Math.min(max, Math.max(min, Number(raw)));
			},
			serialize: (value) => (value === fallback ? null : String(value)),
		};
	},

	/** On when present as `1`; off is the fallback and is never written. */
	flag(): UrlParam<boolean> {
		return {
			fallback: false,
			parse: (raw) => raw === '1',
			serialize: (value) => (value ? '1' : null),
		};
	},
};

interface IntegerOptions {
	fallback: number;
	min?: number;
	max?: number;
}

/** Every param of the spec, parsed. Params the spec does not name are ignored. */
export function readUrlState<S extends UrlStateSpec>(params: URLSearchParams, spec: S): UrlStateValues<S> {
	const values: Record<string, unknown> = {};
	for (const [name, param] of Object.entries(spec)) values[name] = param.parse(params.get(name));
	return values as UrlStateValues<S>;
}

/**
 * A copy of `url` with `patch` applied on top of the state it already carries. Params equal to
 * their fallback are removed; params outside the spec are kept as they are.
 */
export function writeUrlState<S extends UrlStateSpec>(url: URL, spec: S, patch: Partial<UrlStateValues<S>>): URL {
	const next = new URL(url);
	const values = { ...readUrlState(url.searchParams, spec), ...patch };
	for (const [name, param] of Object.entries(spec)) {
		const raw = param.serialize(values[name]);
		if (raw === null) next.searchParams.delete(name);
		else next.searchParams.set(name, raw);
	}
	return next;
}

/** `writeUrlState` as a same-origin `href` (path + search) for links. */
export function urlStateHref<S extends UrlStateSpec>(url: URL, spec: S, patch: Partial<UrlStateValues<S>>): string {
	const next = writeUrlState(url, spec, patch);
	return next.pathname + next.search;
}
