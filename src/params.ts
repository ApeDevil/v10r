import { defineParams } from '@sveltejs/kit/params';
// The leaf, not the `#lib/i18n` barrel: SvelteKit loads this file in Node's own resolver
// at build time, which needs every relative import to carry its extension.
import { isLocale } from '#lib/i18n/runtime.ts';

export const params = defineParams({
	/**
	 * Matches only the real locale prefixes used by this app.
	 * The optional [[locale=locale]] segment will only consume the first path
	 * segment when it is one of these values — preventing /blog, /admin, /api,
	 * etc. from being silently swallowed.
	 *
	 * A matcher returns the param's value, or `undefined` to refuse it. A boolean
	 * would make `false` a matched value, so every first segment would match.
	 *
	 * baseLocale "en" is served unprefixed (no /en/ in the URL) but `isLocale`
	 * accepts it so the rare case of /en being typed directly is intercepted by
	 * stripBaseLocalePrefix (308 → /) before reaching routing.
	 */
	locale: (param: string) => (isLocale(param) ? param : undefined),
});
