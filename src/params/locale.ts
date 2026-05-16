import type { ParamMatcher } from '@sveltejs/kit';

/**
 * Matches only the real locale prefixes used by this app.
 * The optional [[locale=locale]] segment will only consume the first path
 * segment when it is one of these values — preventing /blog, /admin, /api,
 * etc. from being silently swallowed.
 *
 * baseLocale "en" is served unprefixed (no /en/ in the URL) but "en" is
 * included here so that the rare case of /en being typed directly is
 * intercepted by stripBaseLocalePrefix (308 → /) before reaching routing.
 */
export const match: ParamMatcher = (param) => {
	return param === 'en' || param === 'de' || param === 'ru';
};
