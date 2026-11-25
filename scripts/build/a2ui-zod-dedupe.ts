/**
 * One zod 3 in the generative-surface renderer instead of two.
 *
 * `@a2ui/web_core` 0.15 depends on `zod@^3.25` and gets its own nested copy
 * (`node_modules/@a2ui/web_core/node_modules/zod`). It also imports `zod-to-json-schema`, which
 * imports `zod/v3` and resolves to the app's zod 4 — whose `zod/v3` entry ships the same zod 3
 * API. The lazy renderer chunk carried both copies (~100 KB each before minification).
 *
 * This resolver sends web_core's bare `zod` imports to the app's `zod/v3`, so both importers
 * share one module. The two copies differ only by fixes in the newer one (`__proto__` keys
 * dropped when an object schema parses, an emoji regex fix); the API web_core uses is the same.
 * Scoped to importers inside web_core: nothing else changes resolution. Remove it when
 * web_core moves to zod 4 or stops nesting its own copy.
 *
 * Used by `vite.config.ts` (every build environment), the unit-test lane in
 * `vitest.config.ts` (so web_core's catalog validation is tested against the copy that ships)
 * and the generative UI bench (so its bundle figures are the production ones).
 */
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const WEB_CORE = '/node_modules/@a2ui/web_core/';
/** Resolve `zod/v3` as the app root does, not as web_core does. */
const APP_IMPORTER = fileURLToPath(new URL('../../package.json', import.meta.url));

export function a2uiZodDedupe(): Plugin {
	return {
		name: 'v10r:a2ui-zod-dedupe',
		enforce: 'pre',
		async resolveId(source, importer, options) {
			if (source !== 'zod' || !importer?.replaceAll('\\', '/').includes(WEB_CORE)) return null;
			return this.resolve('zod/v3', APP_IMPORTER, { ...options, skipSelf: true });
		},
	};
}
