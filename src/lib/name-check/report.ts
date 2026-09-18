/**
 * The wire contract of a name check — what the page renders and the JSON route returns.
 *
 * Client-side because the showcase components render these and a `.svelte` file may
 * never reach into `$lib/server/`; the domain imports the shapes from here so there is
 * one declaration rather than two that drift (the `velocity/measurement.ts` precedent).
 *
 * Vocabulary (see `docs/naming.md`): a *name source* is one upstream; a *name match* is
 * one thing it found; *coverage* says how far each source got; the *conflict signal*
 * summarises the evidence. Nothing here is a legal conclusion, and the field names are
 * chosen so that a rendering cannot accidentally read like one — there is no `risk`,
 * `safe`, `available` or `verdict` anywhere in this contract.
 */
import type { NameCheckCategory, NameCheckTerritory } from '$lib/schemas/name-check';

export const NAME_SOURCE_IDS = [
	'euipo',
	'gleif',
	'rdap',
	'web',
	'dpma',
	'tmview',
	'wipo',
	'uspto',
	'handelsregister',
	'opencorporates',
] as const;
export type NameSourceId = (typeof NAME_SOURCE_IDS)[number];

/** Sources that run an automated search; the rest are manual links only. */
export const LIVE_NAME_SOURCE_IDS = ['euipo', 'gleif', 'rdap', 'web'] as const;
export type LiveNameSourceId = (typeof LIVE_NAME_SOURCE_IDS)[number];

/** `kind`, not `type`: the four shapes differ, and the page renders each differently. */
export type NameMatchKind = 'trademark' | 'company' | 'domain' | 'web';

export type NameSimilarityBasis = 'exact' | 'normalized' | 'spelling' | 'phonetic' | 'token' | 'affix' | 'loose';

/** Name similarity, 0–100. Presented as exactly that — never as a probability of anything. */
export interface NameSimilarity {
	score: number;
	/** The strongest signal that produced the score; the page shows it as the "why". */
	basis: NameSimilarityBasis;
}

export type NameCategoryRelevance = 'same' | 'possibly' | 'unrelated' | 'unknown';
export type NameTerritoryRelevance = 'same' | 'overlapping' | 'other' | 'unknown';

interface NameMatchBase {
	sourceId: NameSourceId;
	kind: NameMatchKind;
	/** The name as the source spells it. */
	label: string;
	/** Other spellings the source carries (trading names, the host label of a web hit). */
	aliases: string[];
	similarity: NameSimilarity;
	/** ISO-2 country, `EM` for an EU trade mark, `WO` for an international registration, or null. */
	jurisdiction: string | null;
	territoryRelevance: NameTerritoryRelevance;
	/** The source's own identifier (application number, LEI, domain, URL host). */
	externalId: string | null;
	/** The authoritative record, when the source has one. */
	url: string | null;
	/** ISO timestamp of the upstream fetch this match came from — older than the report when cached. */
	retrievedAt: string;
}

export interface TrademarkNameMatch extends NameMatchBase {
	kind: 'trademark';
	status: string | null;
	/** Whether the source reports the mark as live (registered or pending), as opposed to expired, refused or withdrawn. */
	active: boolean;
	owner: string | null;
	niceClasses: number[];
	categoryRelevance: NameCategoryRelevance;
}

export interface CompanyNameMatch extends NameMatchBase {
	kind: 'company';
	status: string | null;
	active: boolean;
}

export type DomainRegistration = 'registered' | 'not_registered' | 'dns_records' | 'unknown' | 'lookup_unavailable';

export interface DomainNameMatch extends NameMatchBase {
	kind: 'domain';
	domain: string;
	registration: DomainRegistration;
	registrar: string | null;
	registeredAt: string | null;
}

export interface WebNameMatch extends NameMatchBase {
	kind: 'web';
	host: string;
	title: string;
	snippet: string | null;
}

export type NameMatch = TrademarkNameMatch | CompanyNameMatch | DomainNameMatch | WebNameMatch;

export type NameCoverageStatus =
	| 'complete'
	| 'unavailable'
	| 'quota_exhausted'
	| 'credentials_missing'
	| 'timed_out'
	| 'manual_only';

export interface NameCheckCoverage {
	sourceId: NameSourceId;
	kind: NameMatchKind;
	status: NameCoverageStatus;
	/** Always present: the user can verify any finding against the source itself. */
	manualUrl: string;
	retrievedAt: string | null;
	cached: boolean;
	matchCount: number;
}

/** Descriptive levels, derived from evidence — never from a count of matches. */
export type NameConflictLevel = 'none' | 'similar' | 'potential' | 'strong';

export type NameConflictReasonCode =
	| 'trademark_exact'
	| 'trademark_similar'
	| 'trademark_active'
	| 'trademark_territory'
	| 'trademark_category'
	| 'company_exact'
	| 'company_similar'
	| 'domain_registered'
	| 'web_usage'
	| 'coverage_incomplete';

/** Localised on the page from the code; params carry the specifics (a score, a count, a list). */
export interface NameConflictReason {
	code: NameConflictReasonCode;
	params?: Record<string, string | number>;
}

export interface NameConflictSignal {
	level: NameConflictLevel;
	reasons: NameConflictReason[];
	/** True when the evidence or the coverage means a person should look further. */
	manualReviewRecommended: boolean;
}

export interface NameCheckReport {
	query: {
		raw: string;
		normalized: string;
		territory: NameCheckTerritory;
		category: NameCheckCategory | null;
	};
	signal: NameConflictSignal;
	matches: NameMatch[];
	coverage: NameCheckCoverage[];
	generatedAt: string;
}
