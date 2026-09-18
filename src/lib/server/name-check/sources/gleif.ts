/**
 * GLEIF — the Global LEI index. Keyless, official, worldwide, and incomplete by design:
 * only entities that hold a Legal Entity Identifier appear, which is most financial
 * counterparties and a fraction of everyone else. A miss here is "no LEI holder by that
 * name", never "no company by that name" — the coverage row and the docs both say so.
 *
 * Two calls: a full-text search over legal and other names, and the fuzzy completion
 * endpoint that catches near-spellings. Either may fail alone; both failing fails the
 * source. GLEIF asks for 60 requests a minute, which the daily quota keeps well under.
 */
import { NAME_CHECK_TERRITORIES } from '$lib/schemas/name-check';
import { NameSourceError } from '../errors';
import { fetchJson } from '../fetch-json';
import type { CompanyDraft, NameSource } from '../name-source';

const API = 'https://api.gleif.org/api/v1';
const PAGE_SIZE = 20;

interface LeiRecord {
	attributes?: {
		lei?: string;
		entity?: {
			legalName?: { name?: string };
			otherNames?: Array<{ name?: string }>;
			jurisdiction?: string;
			legalAddress?: { country?: string };
			status?: string;
		};
	};
}

export interface LeiRecordsResponse {
	data?: LeiRecord[];
}

interface FuzzyCompletion {
	attributes?: { value?: string };
	relationships?: { 'lei-records'?: { data?: { id?: string } } };
}

export interface FuzzyCompletionsResponse {
	data?: FuzzyCompletion[];
}

function recordUrl(lei: string): string {
	return `https://search.gleif.org/#/record/${encodeURIComponent(lei)}`;
}

/** GLEIF spells jurisdictions as `US-DE`; the country is what territory relevance needs. */
function countryOf(entity: NonNullable<LeiRecord['attributes']>['entity']): string | null {
	const code = entity?.jurisdiction ?? entity?.legalAddress?.country;
	return code ? code.slice(0, 2).toUpperCase() : null;
}

/** Pure mapping, fixture-tested. Full records first so dedupe keeps the richer row. */
export function toGleifDrafts(
	records: LeiRecordsResponse | null,
	completions: FuzzyCompletionsResponse | null,
): CompanyDraft[] {
	const drafts: CompanyDraft[] = [];

	for (const record of records?.data ?? []) {
		const entity = record.attributes?.entity;
		const label = entity?.legalName?.name?.trim();
		const lei = record.attributes?.lei ?? null;
		if (!label) continue;
		drafts.push({
			sourceId: 'gleif',
			kind: 'company',
			label,
			aliases: (entity?.otherNames ?? []).map((other) => other.name?.trim() ?? '').filter(Boolean),
			jurisdiction: countryOf(entity),
			externalId: lei,
			url: lei ? recordUrl(lei) : null,
			status: entity?.status ?? null,
			active: entity?.status === 'ACTIVE',
		});
	}

	for (const completion of completions?.data ?? []) {
		const label = completion.attributes?.value?.trim();
		const lei = completion.relationships?.['lei-records']?.data?.id ?? null;
		if (!label) continue;
		// A completion carries a name and an LEI, nothing about status or country: it is
		// shown as found, with its status unknown, and it never counts as an active exact hit.
		drafts.push({
			sourceId: 'gleif',
			kind: 'company',
			label,
			aliases: [],
			jurisdiction: null,
			externalId: lei,
			url: lei ? recordUrl(lei) : null,
			status: null,
			active: false,
		});
	}

	return drafts;
}

export const gleifSource: NameSource = {
	id: 'gleif',
	kind: 'company',
	territories: NAME_CHECK_TERRITORIES,
	manualUrl: (query) => `https://search.gleif.org/#/search/simpleSearch=${encodeURIComponent(query.raw)}`,
	async search(query, ctx) {
		const term = encodeURIComponent(query.normalized.canonical);
		const [records, completions] = await Promise.allSettled([
			fetchJson<LeiRecordsResponse>({
				url: `${API}/lei-records?filter[fulltext]=${term}&page[size]=${PAGE_SIZE}`,
				headers: { accept: 'application/vnd.api+json' },
				signal: ctx.signal,
				fetch: ctx.fetch,
			}),
			fetchJson<FuzzyCompletionsResponse>({
				url: `${API}/fuzzycompletions?field=fulltext&q=${term}`,
				headers: { accept: 'application/vnd.api+json' },
				signal: ctx.signal,
				fetch: ctx.fetch,
			}),
		]);

		if (records.status === 'rejected' && completions.status === 'rejected') {
			throw records.reason instanceof Error ? records.reason : new NameSourceError('unavailable', 'GLEIF unreachable');
		}
		return toGleifDrafts(
			records.status === 'fulfilled' ? records.value.body : null,
			completions.status === 'fulfilled' ? completions.value.body : null,
		);
	},
};
