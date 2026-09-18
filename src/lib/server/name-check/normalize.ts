/**
 * One normalisation for every name the check touches — the query and every candidate.
 *
 * "The Velo-Raptor!" and "veloraptor" must land on the same string, or exact matching
 * is theatre. The steps are the spec's: Unicode fold, accent strip, lowercase, drop
 * punctuation and whitespace, drop a leading article and trailing legal forms. Both the
 * folded tokens and the glued `compact` form are kept because the similarity engine
 * needs each.
 *
 * This is the only normaliser for names; `docs/doc-filter.ts`'s `slugify` is for URLs
 * and destroys accented letters, which is exactly wrong here.
 */

export interface NormalizedName {
	raw: string;
	/** Folded tokens joined by single spaces. */
	canonical: string;
	/** Folded tokens glued together — the matching key. */
	compact: string;
	tokens: string[];
}

/** Letters NFKD leaves alone but a name search should not distinguish. */
const FOLD: Record<string, string> = {
	ß: 'ss',
	æ: 'ae',
	œ: 'oe',
	ø: 'o',
	đ: 'd',
	ł: 'l',
	þ: 'th',
	ð: 'd',
};

const LEADING_ARTICLES = new Set(['the', 'die', 'der', 'das', 'le', 'la', 'les', 'el', 'los', 'las', 'il']);

/** Post-fold spellings, so `OÜ` is matched as `ou`. Only trailing tokens are stripped. */
const LEGAL_SUFFIXES = new Set([
	'gmbh',
	'ag',
	'ug',
	'kg',
	'ohg',
	'gbr',
	'ev',
	'se',
	'ou',
	'ltd',
	'llc',
	'lp',
	'llp',
	'inc',
	'co',
	'corp',
	'plc',
	'bv',
	'nv',
	'sa',
	'sarl',
	'srl',
	'sas',
	'spa',
	'ab',
	'oy',
	'as',
	'aps',
	'limited',
	'incorporated',
	'company',
	'corporation',
	'holding',
	'holdings',
	'group',
]);

export function normalizeName(raw: string): NormalizedName {
	const folded = raw
		.normalize('NFKD')
		.replace(/\p{M}+/gu, '')
		.toLowerCase()
		.replace(/[ßæœøđłþð]/g, (ch) => FOLD[ch] ?? ch);

	let tokens = folded.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
	if (tokens.length > 1 && LEADING_ARTICLES.has(tokens[0] ?? '')) tokens = tokens.slice(1);
	while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1] ?? '')) tokens = tokens.slice(0, -1);

	return { raw: raw.trim(), canonical: tokens.join(' '), compact: tokens.join(''), tokens };
}
