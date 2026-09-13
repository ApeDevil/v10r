/**
 * navigation — a "where is…" question is answered by a verified path, before generation.
 *
 * The model could otherwise only obtain the path by spending a tool step on
 * `search_catalog` (and, with the raw sentence as the query, the AND-matcher often found
 * nothing). So the lane searches first: `wantsNavigation` gates it (deterministic;
 * en/de/ru), `catalogQueryOf` distils the sentence into what the matcher can answer, and
 * the rows enter the prompt as `<catalog-results>`, paths verbatim. They count as surfaced
 * this turn exactly like `search_catalog` output — chips and the path verifier read the
 * same rows. Embedding-free, so it runs beside the embedding lanes at no quota cost.
 */
import { tokenize } from '$lib/search/match';
import type { SearchResult, SearchSurface } from '$lib/search/types';
import { type AssistantCapability, catalogSink, describeError } from '../profile/profile';
import { searchCatalogRecords } from '../tools/search-catalog';
import { catalogGroundingItem } from './catalog';

/** Verified catalog rows a navigation question gets before generation (`<catalog-results>`). */
export const CATALOG_RESULTS_LIMIT = 5;

/** Navigation-intent gate: does the message ask WHERE something lives, or for a link to it? */
export function wantsNavigation(text: string): boolean {
	return /\b(?:where(?:'s| is| are| can i find| do i find)|links? (?:to|for)|(?:give|send|show) me (?:the |a )?(?:link|page|url)|take me to|wo (?:ist|sind|finde ich)|links? zu|zeig(?:e)? mir)\b|где|ссылк|покажи/i.test(
		text,
	);
}

/** A catalog search distilled from a navigation question: the subject, and the kind of surface named. */
export interface CatalogQuery {
	query: string;
	surface: SearchSurface | null;
}

/** The kind of surface a navigation question names, mapped to the catalog surface it means. */
const SURFACE_WORDS: Record<string, SearchSurface> = {
	showcase: 'showcase',
	showcases: 'showcase',
	component: 'showcase',
	components: 'showcase',
	demo: 'showcase',
	demos: 'showcase',
	komponente: 'showcase',
	компонент: 'showcase',
	демо: 'showcase',
	doc: 'doc',
	docs: 'doc',
	documentation: 'doc',
	doku: 'doc',
	dokumentation: 'doc',
	документация: 'doc',
	документацию: 'doc',
	доки: 'doc',
	blog: 'blog',
	post: 'blog',
	posts: 'blog',
	article: 'blog',
	articles: 'blog',
	artikel: 'blog',
	beitrag: 'blog',
	статья: 'blog',
	статью: 'blog',
	пост: 'blog',
};

/** The asking, not the subject: navigation phrasing and function words the matcher must not see. */
const NAVIGATION_NOISE: ReadonlySet<string> = new Set(
	(
		'where is are was the a an to of for in on at about me my i you it this that and or can could do does find ' +
		'get give go send show take link links url page pages section please how what which want need looking ' +
		'wo ist sind der die das den dem des ein eine einen einem einer zu zum zur über mir mich ich du sie es und ' +
		'oder bitte seite seiten zeig zeige zeigen finde finden gibt kann wie was welche welcher welches ' +
		'где ссылка ссылку ссылки на мне дай дайте покажи покажите найти найду как и или в к у о об про это эта ' +
		'этот эту страница страницу страницы пожалуйста есть можно хочу нужна нужен'
	).split(' '),
);

/**
 * Distil a navigation question into what the catalog's AND-matcher can answer: every token
 * is either a surface word (→ the `surface` facet), noise, or part of the subject. "Where is
 * the auth showcase? Give me the link." → `{ query: 'auth', surface: 'showcase' }`. Null when
 * no subject is left — the model then reaches for `search_catalog` as before.
 */
export function catalogQueryOf(text: string): CatalogQuery | null {
	let surface: SearchSurface | null = null;
	const subject: string[] = [];
	for (const token of tokenize(text)) {
		const facet = SURFACE_WORDS[token];
		if (facet) {
			surface ??= facet;
			continue;
		}
		if (!NAVIGATION_NOISE.has(token)) subject.push(token);
	}
	return subject.length > 0 ? { query: subject.join(' '), surface } : null;
}

export const navigation: AssistantCapability = {
	id: 'navigation',
	when: 'the question asks where something lives or for a link to it, and names a subject',
	guidance:
		'A <catalog-results> block holds verified catalog rows found for a navigation question before you answer: cite their paths exactly as written, and call `search_catalog` only if none of them is what the user asked for.',
	sources: ['catalog'],
	activates: (turn) => {
		if (!wantsNavigation(turn.userMsgText)) return { active: false, reason: 'no_intent' };
		return catalogQueryOf(turn.userMsgText) ? { active: true } : { active: false, reason: 'no_subject' };
	},
	grounding: async (turn, state) => {
		const catalogQuery = catalogQueryOf(turn.userMsgText) as CatalogQuery;
		let rows: SearchResult[];
		try {
			rows = await searchCatalogRecords(catalogQuery.query, {
				locale: turn.locale,
				authCeiling: turn.authCeiling,
				surface: catalogQuery.surface,
				limit: CATALOG_RESULTS_LIMIT,
			});
		} catch (err) {
			return { source: { id: 'catalog', ran: false, error: describeError(err), items: [] }, blocks: [] };
		}
		catalogSink(state, 'catalog').record(rows);
		const lines = rows.map(
			(r) => `- [${r.surface}] ${r.title} — ${r.path}${r.anchor ?? ''} (${r.breadcrumb.join(' › ')})`,
		);
		return {
			source: {
				id: 'catalog',
				ran: true,
				cutoff: CATALOG_RESULTS_LIMIT,
				items: rows.map((row, rank) => ({
					...catalogGroundingItem(row, rank, 'included'),
					blockId: 'catalog-results',
				})),
			},
			blocks:
				rows.length > 0
					? [
							{
								id: 'catalog-results',
								section: 'grounding',
								text: `<catalog-results>\n${lines.join('\n')}\n</catalog-results>`,
								stable: false,
							},
						]
					: [],
		};
	},
};
