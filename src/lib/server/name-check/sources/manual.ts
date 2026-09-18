/**
 * Registries the check may not query automatically — no API, a paid contract, or terms
 * that forbid scripted access. Each still appears in the coverage list as `manual_only`
 * with the official search, because "we did not look there" is information the user
 * needs, and a link is the honest substitute for a result.
 *
 * DPMA: DPMAconnectPlus needs a contract and a connection fee; DPMAregister itself may
 * not be scraped. TMview (EUIPO-hosted) federates DPMA, EUIPO and WIPO data and is the
 * best single manual search for a German or EU territory. WIPO and USPTO publish no
 * search API. The Handelsregister has no API; OpenCorporates' free API tier is closed
 * to general use.
 */
import type { NameCheckTerritory } from '$lib/schemas/name-check';
import type { NameSource } from '../name-source';

const ALL: readonly NameCheckTerritory[] = ['de', 'eu', 'worldwide'];

export const dpmaSource: NameSource = {
	id: 'dpma',
	kind: 'trademark',
	territories: ['de'],
	manualUrl: () => 'https://register.dpma.de/DPMAregister/marke/einsteiger',
};

export const tmviewSource: NameSource = {
	id: 'tmview',
	kind: 'trademark',
	territories: ALL,
	manualUrl: (query) =>
		`https://www.tmdn.org/tmview/#/tmview/results?page=1&pageSize=30&criteria=C&basicSearch=${encodeURIComponent(query.raw)}`,
};

export const wipoSource: NameSource = {
	id: 'wipo',
	kind: 'trademark',
	territories: ALL,
	manualUrl: () => 'https://branddb.wipo.int/en/quicksearch',
};

export const usptoSource: NameSource = {
	id: 'uspto',
	kind: 'trademark',
	territories: ['worldwide'],
	manualUrl: () => 'https://tmsearch.uspto.gov/search/search-information',
};

export const handelsregisterSource: NameSource = {
	id: 'handelsregister',
	kind: 'company',
	territories: ['de'],
	manualUrl: () => 'https://www.handelsregister.de/rp_web/erweitertesuche.xhtml',
};

export const opencorporatesSource: NameSource = {
	id: 'opencorporates',
	kind: 'company',
	territories: ALL,
	manualUrl: (query) => `https://opencorporates.com/companies?q=${encodeURIComponent(query.raw)}`,
};
