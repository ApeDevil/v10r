import type { ParamMatcher } from '@sveltejs/kit';
import { isLocale } from '$lib/i18n';

/**
 * Matches only the real locale prefixes used by this app.
 * The optional [[locale=locale]] segment will only consume the first path
 * segment when it is one of these values — preventing /blog, /admin, /api,
 * etc. from being silently swallowed.
 *
 * baseLocale "en" is served unprefixed (no /en/ in the URL) but `isLocale`
 * accepts it so the rare case of /en being typed directly is intercepted by
 * stripBaseLocalePrefix (308 → /) before reaching routing.
 */
export const match: ParamMatcher = (param) => isLocale(param);
