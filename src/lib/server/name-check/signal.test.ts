import { describe, expect, it } from 'vitest';
import type {
	CompanyNameMatch,
	DomainNameMatch,
	NameCheckCoverage,
	TrademarkNameMatch,
	WebNameMatch,
} from '$lib/name-check/report';
import { categoryRelevance } from './nice-classes';
import { territoryRelevance } from './relevance';
import { conflictSignal } from './signal';

const NOW = '2026-09-16T10:00:00.000Z';

function trademark(overrides: Partial<TrademarkNameMatch> = {}): TrademarkNameMatch {
	return {
		sourceId: 'euipo',
		kind: 'trademark',
		label: 'VELORA',
		aliases: [],
		similarity: { score: 100, basis: 'exact' },
		jurisdiction: 'EM',
		territoryRelevance: 'same',
		externalId: '018000001',
		url: null,
		retrievedAt: NOW,
		status: 'REGISTERED',
		active: true,
		owner: 'Velora AG',
		niceClasses: [9, 42],
		categoryRelevance: 'same',
		...overrides,
	};
}

function company(overrides: Partial<CompanyNameMatch> = {}): CompanyNameMatch {
	return {
		sourceId: 'gleif',
		kind: 'company',
		label: 'Velora OÜ',
		aliases: [],
		similarity: { score: 100, basis: 'normalized' },
		jurisdiction: 'EE',
		territoryRelevance: 'overlapping',
		externalId: '984500F8295F478CE191',
		url: null,
		retrievedAt: NOW,
		status: 'ACTIVE',
		active: true,
		...overrides,
	};
}

function domain(registration: DomainNameMatch['registration'], tld = 'com'): DomainNameMatch {
	return {
		sourceId: 'rdap',
		kind: 'domain',
		label: `velora.${tld}`,
		aliases: ['velora'],
		similarity: { score: 100, basis: 'normalized' },
		jurisdiction: null,
		territoryRelevance: 'unknown',
		externalId: `velora.${tld}`,
		url: null,
		retrievedAt: NOW,
		domain: `velora.${tld}`,
		registration,
		registrar: null,
		registeredAt: null,
	};
}

function web(): WebNameMatch {
	return {
		sourceId: 'web',
		kind: 'web',
		label: 'Velora — home',
		aliases: ['velora'],
		similarity: { score: 100, basis: 'normalized' },
		jurisdiction: null,
		territoryRelevance: 'unknown',
		externalId: 'velora.io',
		url: 'https://velora.io',
		retrievedAt: NOW,
		host: 'velora.io',
		title: 'Velora — home',
		snippet: null,
	};
}

function coverage(
	status: NameCheckCoverage['status'],
	kind: NameCheckCoverage['kind'] = 'trademark',
): NameCheckCoverage {
	return {
		sourceId: 'euipo',
		kind,
		status,
		manualUrl: 'https://example.test',
		retrievedAt: null,
		cached: false,
		matchCount: 0,
	};
}

describe('conflictSignal', () => {
	it('is strong for an exact live mark in the territory and category, and says why', () => {
		const signal = conflictSignal([trademark()], [coverage('complete')]);
		expect(signal.level).toBe('strong');
		expect(signal.reasons.map((r) => r.code)).toEqual([
			'trademark_exact',
			'trademark_active',
			'trademark_territory',
			'trademark_category',
		]);
		expect(signal.manualReviewRecommended).toBe(true);
	});

	it('is potential, not strong, when the category is unknown or only related', () => {
		expect(conflictSignal([trademark({ categoryRelevance: 'unknown' })], []).level).toBe('potential');
		expect(
			conflictSignal([trademark({ categoryRelevance: 'possibly', similarity: { score: 88, basis: 'phonetic' } })], [])
				.level,
		).toBe('potential');
	});

	it('is similar for an expired mark or one in another territory', () => {
		expect(conflictSignal([trademark({ active: false, status: 'EXPIRED' })], []).level).toBe('similar');
		expect(conflictSignal([trademark({ territoryRelevance: 'other', jurisdiction: 'US' })], []).level).toBe('similar');
	});

	it('lifts an exact active company in the territory to potential', () => {
		const signal = conflictSignal([company({ territoryRelevance: 'same' })], []);
		expect(signal.level).toBe('potential');
		expect(signal.reasons[0]?.code).toBe('company_exact');
	});

	it('treats a similar company as similar', () => {
		const signal = conflictSignal(
			[company({ similarity: { score: 81, basis: 'token' }, territoryRelevance: 'same' })],
			[],
		);
		expect(signal.level).toBe('similar');
		expect(signal.reasons[0]).toEqual({ code: 'company_similar', params: { count: 1 } });
	});

	it('bundles a registered exact domain with web usage into potential', () => {
		expect(conflictSignal([domain('registered')], []).level).toBe('similar');
		expect(conflictSignal([domain('registered'), web()], []).level).toBe('potential');
		expect(conflictSignal([domain('not_registered'), web()], []).level).toBe('similar');
	});

	it('is none with nothing found and full coverage — and still not a legal verdict', () => {
		const signal = conflictSignal([], [coverage('complete')]);
		expect(signal).toEqual({ level: 'none', reasons: [], manualReviewRecommended: false });
	});

	it('recommends manual review whenever a trade mark source in scope was not searched', () => {
		const signal = conflictSignal([], [coverage('complete'), { ...coverage('manual_only'), sourceId: 'dpma' }]);
		expect(signal.level).toBe('none');
		expect(signal.manualReviewRecommended).toBe(true);
		expect(signal.reasons).toEqual([{ code: 'coverage_incomplete', params: { sources: 'dpma' } }]);
	});

	it('ignores non-trademark coverage gaps for the manual-review flag', () => {
		expect(conflictSignal([], [coverage('credentials_missing', 'web')]).manualReviewRecommended).toBe(false);
	});
});

describe('relevance', () => {
	it('treats an EU mark as covering Germany', () => {
		expect(territoryRelevance('EM', 'de')).toBe('same');
		expect(territoryRelevance('DE', 'de')).toBe('same');
		expect(territoryRelevance('WO', 'de')).toBe('overlapping');
		expect(territoryRelevance('US', 'de')).toBe('other');
		expect(territoryRelevance(null, 'de')).toBe('unknown');
	});

	it('scopes the EU territory to EU marks and member states', () => {
		expect(territoryRelevance('EM', 'eu')).toBe('same');
		expect(territoryRelevance('EE', 'eu')).toBe('overlapping');
		expect(territoryRelevance('GB', 'eu')).toBe('other');
	});

	it('takes everything for worldwide discovery', () => {
		expect(territoryRelevance('JP', 'worldwide')).toBe('same');
	});

	it('maps Nice classes to the chosen category', () => {
		expect(categoryRelevance([9, 42], 'software')).toBe('same');
		expect(categoryRelevance([35], 'software')).toBe('possibly');
		expect(categoryRelevance([25], 'software')).toBe('unrelated');
		expect(categoryRelevance([], 'software')).toBe('unknown');
		expect(categoryRelevance([9], null)).toBe('unknown');
		expect(categoryRelevance([9], 'other')).toBe('unknown');
	});
});
