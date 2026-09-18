/**
 * The conflict signal: what the evidence says, in the spec's four descriptive levels.
 *
 * Each level is a predicate over the matches — an exact, live trade mark in the user's
 * territory and category is "strong"; a close one in a related category is "potential";
 * anything above the similarity floor is "similar". The level is never a count, and
 * the reasons are returned as codes so the page can say why in the reader's language.
 *
 * `manualReviewRecommended` is the honest half: it is set whenever a trade mark source in
 * scope could not be searched automatically (DPMA never can be), because "no matches in
 * the databases we could reach" is not "no matches".
 */
import type {
	NameCheckCoverage,
	NameConflictLevel,
	NameConflictReason,
	NameConflictSignal,
	NameMatch,
	TrademarkNameMatch,
} from '$lib/name-check/report';

const NEAR_EXACT = 95;
const CLOSE = 85;

function relevantTerritory(match: NameMatch): boolean {
	return match.territoryRelevance === 'same' || match.territoryRelevance === 'overlapping';
}

function strongTrademark(mark: TrademarkNameMatch): boolean {
	return (
		mark.similarity.score >= NEAR_EXACT &&
		mark.active &&
		mark.territoryRelevance === 'same' &&
		mark.categoryRelevance === 'same'
	);
}

function potentialTrademark(mark: TrademarkNameMatch): boolean {
	if (!mark.active || !relevantTerritory(mark)) return false;
	if (mark.similarity.score >= CLOSE && (mark.categoryRelevance === 'same' || mark.categoryRelevance === 'possibly')) {
		return true;
	}
	return mark.similarity.score >= NEAR_EXACT && mark.categoryRelevance === 'unknown';
}

export function conflictSignal(
	matches: readonly NameMatch[],
	coverage: readonly NameCheckCoverage[],
): NameConflictSignal {
	const trademarks = matches.filter((m): m is TrademarkNameMatch => m.kind === 'trademark');
	const companies = matches.filter((m) => m.kind === 'company');
	const registeredDomains = matches.filter((m) => m.kind === 'domain' && m.registration === 'registered');
	const webUses = matches.filter((m) => m.kind === 'web');

	const reasons: NameConflictReason[] = [];
	let level: NameConflictLevel = 'none';

	const leadMark = trademarks.reduce<TrademarkNameMatch | null>(
		(best, mark) => (best === null || mark.similarity.score > best.similarity.score ? mark : best),
		null,
	);
	if (leadMark) {
		if (trademarks.some(strongTrademark)) level = 'strong';
		else if (trademarks.some(potentialTrademark)) level = 'potential';
		else level = 'similar';

		reasons.push(
			leadMark.similarity.score >= NEAR_EXACT
				? { code: 'trademark_exact', params: { name: leadMark.label } }
				: { code: 'trademark_similar', params: { name: leadMark.label, score: leadMark.similarity.score } },
		);
		if (leadMark.active) reasons.push({ code: 'trademark_active', params: { status: leadMark.status ?? '' } });
		if (relevantTerritory(leadMark) && leadMark.jurisdiction) {
			reasons.push({ code: 'trademark_territory', params: { jurisdiction: leadMark.jurisdiction } });
		}
		if (leadMark.categoryRelevance === 'same' || leadMark.categoryRelevance === 'possibly') {
			reasons.push({ code: 'trademark_category', params: { classes: leadMark.niceClasses.join(', ') } });
		}
	}

	const exactCompany = companies.find(
		(c) => c.similarity.score >= NEAR_EXACT && c.active && c.territoryRelevance === 'same',
	);
	if (exactCompany) {
		if (level === 'none' || level === 'similar') level = 'potential';
		reasons.push({
			code: 'company_exact',
			params: { name: exactCompany.label, jurisdiction: exactCompany.jurisdiction ?? '' },
		});
	} else if (companies.length > 0) {
		if (level === 'none') level = 'similar';
		reasons.push({ code: 'company_similar', params: { count: companies.length } });
	}

	if (registeredDomains.length > 0) {
		if (level === 'none') level = 'similar';
		reasons.push({
			code: 'domain_registered',
			params: { domains: registeredDomains.map((d) => (d.kind === 'domain' ? d.domain : d.label)).join(', ') },
		});
	}

	if (webUses.length > 0) {
		if (level === 'none') level = 'similar';
		// An exact domain in use AND the name in commercial use on the web is the
		// spec's "moderate" bundle; together they lift a similar to a potential.
		if (level === 'similar' && registeredDomains.some((d) => d.similarity.score >= NEAR_EXACT)) level = 'potential';
		reasons.push({ code: 'web_usage', params: { count: webUses.length } });
	}

	const unsearchedTrademarkSources = coverage.filter((c) => c.kind === 'trademark' && c.status !== 'complete');
	if (unsearchedTrademarkSources.length > 0) {
		reasons.push({
			code: 'coverage_incomplete',
			params: { sources: unsearchedTrademarkSources.map((c) => c.sourceId).join(', ') },
		});
	}

	return {
		level,
		reasons,
		manualReviewRecommended: level === 'potential' || level === 'strong' || unsearchedTrademarkSources.length > 0,
	};
}
