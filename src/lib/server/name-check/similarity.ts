/**
 * Name similarity — the ladder of signals the spec asks for, dependency-free.
 *
 * Exact and normalised equality first, then edit distance for typos, Kölner Phonetik for
 * names that sound alike ("Synex" / "Cinex" both key to 8648), shared dominant tokens
 * ("Velora" / "Velora Labs"), affix containment for glued names ("Velora" / "Velorasoft"),
 * and character bigrams as the loose floor. The best rung wins and names itself as the
 * `basis`, which is what lets the page say WHY a candidate surfaced.
 *
 * Kölner Phonetik over Metaphone: it was designed for German name matching, the
 * territory this check is used in first, and it is thirty lines. The score bands mirror
 * the spec's examples (exact 100, close spelling 94, close pronunciation 88, shared
 * dominant token ~81, loose ~62) so the numbers read the same to a reader of both.
 */
import type { NameSimilarity } from '$lib/name-check/report';
import { type NormalizedName, normalizeName } from './normalize';

export function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;
	let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		for (let j = 1; j <= b.length; j++) {
			const substitution = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
			current[j] = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, substitution);
		}
		previous = current;
	}
	return previous[b.length] ?? 0;
}

function bigrams(word: string): Map<string, number> {
	const counts = new Map<string, number>();
	for (let i = 0; i < word.length - 1; i++) {
		const gram = word.slice(i, i + 2);
		counts.set(gram, (counts.get(gram) ?? 0) + 1);
	}
	return counts;
}

/** Sørensen–Dice over character bigrams, 0–1. */
export function bigramDice(a: string, b: string): number {
	if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
	const left = bigrams(a);
	const right = bigrams(b);
	let shared = 0;
	for (const [gram, count] of left) shared += Math.min(count, right.get(gram) ?? 0);
	return (2 * shared) / (a.length - 1 + (b.length - 1));
}

export function tokenJaccard(a: readonly string[], b: readonly string[]): number {
	const left = new Set(a);
	const right = new Set(b);
	if (left.size === 0 && right.size === 0) return 0;
	let shared = 0;
	for (const token of left) if (right.has(token)) shared++;
	return shared / (left.size + right.size - shared);
}

/**
 * Kölner Phonetik (Postel 1969). Expects a folded, lowercase Latin word.
 *
 * Letters map to digit codes by their neighbours, runs of the same code collapse, and
 * every 0 (vowel) after the first position is dropped — so the key keeps the consonant
 * skeleton that survives most misspellings.
 */
export function colognePhonetic(word: string): string {
	const s = word.toUpperCase().replace(/[^A-Z]/g, '');
	if (s.length === 0) return '';
	let codes = '';
	for (let i = 0; i < s.length; i++) {
		const c = s[i] ?? '';
		const prev = s[i - 1] ?? '';
		const next = s[i + 1] ?? '';
		let code = '';
		switch (c) {
			case 'A':
			case 'E':
			case 'I':
			case 'J':
			case 'O':
			case 'U':
			case 'Y':
				code = '0';
				break;
			case 'H':
				code = '-';
				break;
			case 'B':
				code = '1';
				break;
			case 'P':
				code = next === 'H' ? '3' : '1';
				break;
			case 'D':
			case 'T':
				code = 'CSZ'.includes(next) && next !== '' ? '8' : '2';
				break;
			case 'F':
			case 'V':
			case 'W':
				code = '3';
				break;
			case 'G':
			case 'K':
			case 'Q':
				code = '4';
				break;
			case 'C':
				if (i === 0) code = next !== '' && 'AHKLOQRUX'.includes(next) ? '4' : '8';
				else if ('SZ'.includes(prev) && prev !== '') code = '8';
				else code = next !== '' && 'AHKOQUX'.includes(next) ? '4' : '8';
				break;
			case 'X':
				code = prev !== '' && 'CKQ'.includes(prev) ? '8' : '48';
				break;
			case 'L':
				code = '5';
				break;
			case 'M':
			case 'N':
				code = '6';
				break;
			case 'R':
				code = '7';
				break;
			case 'S':
			case 'Z':
				code = '8';
				break;
		}
		codes += code;
	}
	let collapsed = '';
	let last = '';
	for (const ch of codes) {
		if (ch !== last) collapsed += ch;
		last = ch;
	}
	collapsed = collapsed.replace(/-/g, '');
	return collapsed.slice(0, 1) + collapsed.slice(1).replace(/0/g, '');
}

/** The user's longest token, the one a "Velora Labs" shares with "Velora". */
function dominantToken(tokens: readonly string[]): string {
	return tokens.reduce((longest, token) => (token.length > longest.length ? token : longest), '');
}

/**
 * Score one candidate against the query. Both are normalised the same way, so a candidate
 * "Velora OÜ" meets the query "velora" as a normalised match, not a token one.
 */
export function scoreSimilarity(query: NormalizedName, candidateRaw: string): NameSimilarity {
	const candidate = normalizeName(candidateRaw);
	if (query.compact.length === 0 || candidate.compact.length === 0) return { score: 0, basis: 'loose' };
	if (query.raw.toLowerCase() === candidate.raw.toLowerCase()) return { score: 100, basis: 'exact' };
	if (query.compact === candidate.compact) return { score: 100, basis: 'normalized' };

	const rungs: NameSimilarity[] = [];
	const distance = levenshtein(query.compact, candidate.compact);
	const longest = Math.max(query.compact.length, candidate.compact.length);

	if (distance <= 2 && longest >= 4 && distance / longest <= 0.34) {
		rungs.push({ score: 100 - distance * 6, basis: 'spelling' });
	}
	if (query.compact.length >= 3 && colognePhonetic(query.compact) === colognePhonetic(candidate.compact)) {
		rungs.push({ score: 88, basis: 'phonetic' });
	}

	const dominant = dominantToken(query.tokens);
	if (dominant.length >= 4 && (candidate.tokens.includes(dominant) || candidate.tokens.includes(query.compact))) {
		rungs.push({ score: 81, basis: 'token' });
	} else {
		const jaccard = tokenJaccard(query.tokens, candidate.tokens);
		if (jaccard >= 0.5) rungs.push({ score: Math.round(60 + jaccard * 40), basis: 'token' });
	}

	const [shorter, longer] =
		query.compact.length <= candidate.compact.length
			? [query.compact, candidate.compact]
			: [candidate.compact, query.compact];
	if (shorter.length >= 4 && (longer.startsWith(shorter) || longer.endsWith(shorter))) {
		rungs.push({ score: Math.round(60 + (20 * shorter.length) / longer.length), basis: 'affix' });
	}

	// The tail: bigram overlap or edit ratio of 0.6 reads as 60, and it can never outrank a
	// shared token, so the band stays where the spec puts it (~62).
	const loose = Math.max(bigramDice(query.compact, candidate.compact), 1 - distance / longest);
	rungs.push({
		score: loose >= 0.6 ? Math.min(79, Math.round(60 + (loose - 0.6) * 100)) : Math.round(loose * 75),
		basis: 'loose',
	});

	return rungs.reduce((best, rung) => (rung.score > best.score ? rung : best));
}

/** The best of several spellings a source carries for one record. */
export function bestSimilarity(query: NormalizedName, spellings: readonly string[]): NameSimilarity {
	let best: NameSimilarity = { score: 0, basis: 'loose' };
	for (const spelling of spellings) {
		const candidate = scoreSimilarity(query, spelling);
		if (candidate.score > best.score) best = candidate;
	}
	return best;
}
