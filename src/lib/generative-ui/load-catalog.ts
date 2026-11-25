/**
 * The catalog document as `@a2ui/web_core`'s runtime `Catalog` — the object its message
 * processor validates components against and its prompt generator describes.
 *
 * Imports only the web_core root, which is lit-free. Never import `@a2ui/web_core/catalogs/*`,
 * `/universal`, `/v0_9/basic_catalog` or the `/v1_0` and `/v0_9` barrels: they register lit
 * web components at module scope (`generative-ui.gate.test.ts` holds the line). This module
 * is reached by the server and by the lazily loaded renderer only — never by an eager route
 * chunk, because the renderer chunk costs ~70 KB gzip.
 */
import { Catalog, type ComponentApi } from '@a2ui/web_core';
import { GENERATIVE_UI_CATALOG } from './catalog.ts';

/**
 * `Catalog.fromJson` types its functions as declarations (`FunctionApi`), while the message
 * processor wants implementations. The v10r catalog declares no functions, so its empty
 * function map is both, and one type serves the processor and the agent alike.
 */
export type GenerativeUiCatalog = Catalog<ComponentApi>;

let loaded: GenerativeUiCatalog | undefined;

/** The v10r catalog, built once per process (or per page) and shared. */
export function loadGenerativeUiCatalog(): GenerativeUiCatalog {
	loaded ??= Catalog.fromJson(structuredClone(GENERATIVE_UI_CATALOG)) as unknown as GenerativeUiCatalog;
	return loaded;
}
