/**
 * The result presenter: every enum the report carries, resolved to the visitor's language
 * once per request, on the server.
 *
 * Not in the components on purpose. A Paraglide message ships all three locales to the
 * client, and this feature has a hundred of them — a dictionary the browser never needs,
 * because the page is rendered inside the i18n middleware where `m.*` already knows the
 * request's locale. The page's `load` returns the maps, the action returns the reason
 * sentences, and the components render strings. The JSON route keeps the codes.
 */
import type {
	DomainRegistration,
	NameCategoryRelevance,
	NameConflictLevel,
	NameConflictReason,
	NameCoverageStatus,
	NameSimilarityBasis,
	NameSourceId,
	NameTerritoryRelevance,
} from '$lib/name-check/report';
import * as m from '$lib/paraglide/messages';
import type { NameCheckCategory, NameCheckTerritory } from '$lib/schemas/name-check';

export const NAME_CHECK_COPY_KEYS = [
	'section_signal',
	'section_trademarks',
	'section_companies',
	'section_domains',
	'section_web',
	'section_coverage',
	'lede',
	'field_name_label',
	'field_name_placeholder',
	'field_territory_label',
	'field_category_label',
	'category_none',
	'submit',
	'submitting',
	'submit_note',
	'error_rejected',
	'error_rate_limited',
	'error_retry',
	'manual_review',
	'why',
	'similarity_label',
	'match_source',
	'match_status',
	'match_status_unknown',
	'match_owner',
	'match_classes',
	'match_host',
	'match_snippet',
	'match_jurisdiction',
	'empty_trademarks',
	'empty_companies',
	'empty_domains',
	'empty_web',
	'domain_col_domain',
	'domain_col_status',
	'domain_col_registrar',
	'domain_col_since',
	'coverage_col_source',
	'coverage_col_status',
	'coverage_col_matches',
	'coverage_col_retrieved',
	'coverage_col_action',
	'coverage_cached',
	'coverage_open',
	'coverage_note',
	'disclaimer_title',
	'disclaimer_body',
] as const;
export type NameCheckCopyKey = (typeof NAME_CHECK_COPY_KEYS)[number];

export interface NameCheckLabels {
	/** Static page copy, keyed by the message name minus its `showcase_name_check_` prefix. */
	copy: Record<NameCheckCopyKey, string>;
	levels: Record<NameConflictLevel, string>;
	coverageStatuses: Record<NameCoverageStatus, string>;
	sources: Record<NameSourceId, string>;
	bases: Record<NameSimilarityBasis, string>;
	registrations: Record<DomainRegistration, string>;
	categoryRelevance: Record<NameCategoryRelevance, string>;
	territoryRelevance: Record<NameTerritoryRelevance, string>;
	territories: Record<NameCheckTerritory, string>;
	categories: Record<NameCheckCategory, string>;
}

/** Resolve every map in the current request's locale. */
export function nameCheckLabels(): NameCheckLabels {
	return {
		copy: {
			section_signal: m.showcase_name_check_section_signal(),
			section_trademarks: m.showcase_name_check_section_trademarks(),
			section_companies: m.showcase_name_check_section_companies(),
			section_domains: m.showcase_name_check_section_domains(),
			section_web: m.showcase_name_check_section_web(),
			section_coverage: m.showcase_name_check_section_coverage(),
			lede: m.showcase_name_check_lede(),
			field_name_label: m.showcase_name_check_field_name_label(),
			field_name_placeholder: m.showcase_name_check_field_name_placeholder(),
			field_territory_label: m.showcase_name_check_field_territory_label(),
			field_category_label: m.showcase_name_check_field_category_label(),
			category_none: m.showcase_name_check_category_none(),
			submit: m.showcase_name_check_submit(),
			submitting: m.showcase_name_check_submitting(),
			submit_note: m.showcase_name_check_submit_note(),
			error_rejected: m.showcase_name_check_error_rejected(),
			error_rate_limited: m.showcase_name_check_error_rate_limited(),
			error_retry: m.showcase_name_check_error_retry(),
			manual_review: m.showcase_name_check_manual_review(),
			why: m.showcase_name_check_why(),
			similarity_label: m.showcase_name_check_similarity_label(),
			match_source: m.showcase_name_check_match_source(),
			match_status: m.showcase_name_check_match_status(),
			match_status_unknown: m.showcase_name_check_match_status_unknown(),
			match_owner: m.showcase_name_check_match_owner(),
			match_classes: m.showcase_name_check_match_classes(),
			match_host: m.showcase_name_check_match_host(),
			match_snippet: m.showcase_name_check_match_snippet(),
			match_jurisdiction: m.showcase_name_check_match_jurisdiction(),
			empty_trademarks: m.showcase_name_check_empty_trademarks(),
			empty_companies: m.showcase_name_check_empty_companies(),
			empty_domains: m.showcase_name_check_empty_domains(),
			empty_web: m.showcase_name_check_empty_web(),
			domain_col_domain: m.showcase_name_check_domain_col_domain(),
			domain_col_status: m.showcase_name_check_domain_col_status(),
			domain_col_registrar: m.showcase_name_check_domain_col_registrar(),
			domain_col_since: m.showcase_name_check_domain_col_since(),
			coverage_col_source: m.showcase_name_check_coverage_col_source(),
			coverage_col_status: m.showcase_name_check_coverage_col_status(),
			coverage_col_matches: m.showcase_name_check_coverage_col_matches(),
			coverage_col_retrieved: m.showcase_name_check_coverage_col_retrieved(),
			coverage_col_action: m.showcase_name_check_coverage_col_action(),
			coverage_cached: m.showcase_name_check_coverage_cached(),
			coverage_open: m.showcase_name_check_coverage_open(),
			coverage_note: m.showcase_name_check_coverage_note(),
			disclaimer_title: m.showcase_name_check_disclaimer_title(),
			disclaimer_body: m.showcase_name_check_disclaimer_body(),
		},
		levels: {
			none: m.showcase_name_check_level_none(),
			similar: m.showcase_name_check_level_similar(),
			potential: m.showcase_name_check_level_potential(),
			strong: m.showcase_name_check_level_strong(),
		},
		coverageStatuses: {
			complete: m.showcase_name_check_coverage_complete(),
			unavailable: m.showcase_name_check_coverage_unavailable(),
			quota_exhausted: m.showcase_name_check_coverage_quota_exhausted(),
			credentials_missing: m.showcase_name_check_coverage_credentials_missing(),
			timed_out: m.showcase_name_check_coverage_timed_out(),
			manual_only: m.showcase_name_check_coverage_manual_only(),
		},
		sources: {
			euipo: m.showcase_name_check_source_euipo(),
			dpma: m.showcase_name_check_source_dpma(),
			tmview: m.showcase_name_check_source_tmview(),
			wipo: m.showcase_name_check_source_wipo(),
			uspto: m.showcase_name_check_source_uspto(),
			gleif: m.showcase_name_check_source_gleif(),
			handelsregister: m.showcase_name_check_source_handelsregister(),
			opencorporates: m.showcase_name_check_source_opencorporates(),
			rdap: m.showcase_name_check_source_rdap(),
			web: m.showcase_name_check_source_web(),
		},
		bases: {
			exact: m.showcase_name_check_basis_exact(),
			normalized: m.showcase_name_check_basis_normalized(),
			spelling: m.showcase_name_check_basis_spelling(),
			phonetic: m.showcase_name_check_basis_phonetic(),
			token: m.showcase_name_check_basis_token(),
			affix: m.showcase_name_check_basis_affix(),
			loose: m.showcase_name_check_basis_loose(),
		},
		registrations: {
			registered: m.showcase_name_check_registration_registered(),
			not_registered: m.showcase_name_check_registration_not_registered(),
			dns_records: m.showcase_name_check_registration_dns_records(),
			unknown: m.showcase_name_check_registration_unknown(),
			lookup_unavailable: m.showcase_name_check_registration_lookup_unavailable(),
		},
		categoryRelevance: {
			same: m.showcase_name_check_category_relevance_same(),
			possibly: m.showcase_name_check_category_relevance_possibly(),
			unrelated: m.showcase_name_check_category_relevance_unrelated(),
			unknown: m.showcase_name_check_category_relevance_unknown(),
		},
		territoryRelevance: {
			same: m.showcase_name_check_territory_relevance_same(),
			overlapping: m.showcase_name_check_territory_relevance_overlapping(),
			other: m.showcase_name_check_territory_relevance_other(),
			unknown: m.showcase_name_check_territory_relevance_unknown(),
		},
		territories: {
			de: m.showcase_name_check_territory_de(),
			eu: m.showcase_name_check_territory_eu(),
			worldwide: m.showcase_name_check_territory_worldwide(),
		},
		categories: {
			software: m.showcase_name_check_category_software(),
			entertainment: m.showcase_name_check_category_entertainment(),
			publishing: m.showcase_name_check_category_publishing(),
			other: m.showcase_name_check_category_other(),
		},
	};
}

/** The headline under the level: "Findings for “{name}”", in the request's locale. */
export function resultsForText(name: string): string {
	return m.showcase_name_check_results_for({ name });
}

/**
 * The "why" sentence for one reason code; params are strings by the time they reach a
 * message. `coverage_incomplete` carries source ids, which read as jargon — they are
 * mapped to the source labels here so the sentence names the registries.
 */
export function conflictReasonText(reason: NameConflictReason, sources: NameCheckLabels['sources']): string {
	const p = reason.params ?? {};
	const text = (key: string) => String(p[key] ?? '');
	const sourceNames = (key: string) =>
		text(key)
			.split(',')
			.map((id) => id.trim())
			.filter(Boolean)
			.map((id) => sources[id as NameSourceId] ?? id)
			.join(', ');
	switch (reason.code) {
		case 'trademark_exact':
			return m.showcase_name_check_reason_trademark_exact({ name: text('name') });
		case 'trademark_similar':
			return m.showcase_name_check_reason_trademark_similar({ name: text('name'), score: text('score') });
		case 'trademark_active':
			return m.showcase_name_check_reason_trademark_active({ status: text('status') });
		case 'trademark_territory':
			return m.showcase_name_check_reason_trademark_territory({ jurisdiction: text('jurisdiction') });
		case 'trademark_category':
			return m.showcase_name_check_reason_trademark_category({ classes: text('classes') });
		case 'company_exact':
			return m.showcase_name_check_reason_company_exact({ name: text('name'), jurisdiction: text('jurisdiction') });
		case 'company_similar':
			return m.showcase_name_check_reason_company_similar({ count: text('count') });
		case 'domain_registered':
			return m.showcase_name_check_reason_domain_registered({ domains: text('domains') });
		case 'web_usage':
			return m.showcase_name_check_reason_web_usage({ count: text('count') });
		case 'coverage_incomplete':
			return m.showcase_name_check_reason_coverage_incomplete({ sources: sourceNames('sources') });
	}
}
