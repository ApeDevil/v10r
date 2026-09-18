/**
 * Territory relevance: does a record's jurisdiction touch where the user wants to use
 * the name?
 *
 * An EU trade mark (`EM`) is enforceable in Germany, so for a German territory it is as
 * relevant as a DPMA mark. An international registration (`WO`) may designate either,
 * which the search cannot see — hence "overlapping", never "same". Worldwide discovery
 * treats every jurisdiction as in scope, because that is what the user asked for.
 */
import type { NameTerritoryRelevance } from '$lib/name-check/report';
import type { NameCheckTerritory } from '$lib/schemas/name-check';

export const EU_MEMBER_STATES = new Set([
	'AT',
	'BE',
	'BG',
	'HR',
	'CY',
	'CZ',
	'DK',
	'EE',
	'FI',
	'FR',
	'DE',
	'GR',
	'HU',
	'IE',
	'IT',
	'LV',
	'LT',
	'LU',
	'MT',
	'NL',
	'PL',
	'PT',
	'RO',
	'SK',
	'SI',
	'ES',
	'SE',
]);

export function territoryRelevance(jurisdiction: string | null, territory: NameCheckTerritory): NameTerritoryRelevance {
	if (!jurisdiction) return 'unknown';
	const code = jurisdiction.toUpperCase();
	if (territory === 'worldwide') return 'same';
	const euMark = code === 'EM' || code === 'EU';
	if (territory === 'de') {
		if (code === 'DE' || euMark) return 'same';
		if (code === 'WO') return 'overlapping';
		return 'other';
	}
	if (euMark) return 'same';
	if (EU_MEMBER_STATES.has(code) || code === 'WO') return 'overlapping';
	return 'other';
}
