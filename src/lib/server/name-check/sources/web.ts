/**
 * Web usage — the name in commercial use where no registry would record it.
 *
 * A vendor seam, because the market for search APIs moves: the first connected of Tavily
 * (a free monthly allowance without a card) then Brave (metered), and without either the
 * source reports `credentials_missing` beside a manual search link. Which vendors are
 * connected is the administrator's call on `/admin/name-check`. The query is the
 * exact phrase; hits are graded by the similarity engine on their host label and title,
 * so "velora.io — Velora" surfaces and a page that merely mentions the word does not.
 */
import { NAME_CHECK_TERRITORIES, type NameCheckTerritory } from '$lib/schemas/name-check';
import { NameSourceError } from '../errors';
import { fetchJson } from '../fetch-json';
import type { NameSource, NameSourceContext, NameSourceCredentials, WebDraft } from '../name-source';

const RESULT_COUNT = 10;

export type WebSearchVendor = 'tavily' | 'brave';

export interface WebSearchHit {
	title: string;
	url: string;
	snippet: string | null;
}

interface TavilyResponse {
	results?: Array<{ title?: string; url?: string; content?: string }>;
}

interface BraveResponse {
	web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
}

export function webSearchVendor(credentials: NameSourceCredentials): WebSearchVendor | null {
	if (credentials.tavilyApiKey) return 'tavily';
	if (credentials.braveApiKey) return 'brave';
	return null;
}

/** `sub.velora.io` → `velora`: the label a brand would own. Good enough for two-level TLDs to rank, not to judge. */
function registrableLabel(hostname: string): string {
	const parts = hostname.split('.').filter(Boolean);
	return parts.length >= 2 ? (parts[parts.length - 2] ?? hostname) : hostname;
}

/** Pure mapping, fixture-tested. */
export function toWebDrafts(hits: readonly WebSearchHit[]): WebDraft[] {
	const drafts: WebDraft[] = [];
	for (const hit of hits) {
		let host: string;
		try {
			host = new URL(hit.url).hostname.replace(/^www\./, '').toLowerCase();
		} catch {
			continue;
		}
		const title = hit.title.trim();
		if (!title) continue;
		drafts.push({
			sourceId: 'web',
			kind: 'web',
			label: title,
			aliases: [registrableLabel(host)],
			jurisdiction: null,
			externalId: host,
			url: hit.url,
			host,
			title,
			snippet: hit.snippet,
		});
	}
	return drafts;
}

/** Tavily's `country` boost takes a lowercase country name; only the German territory maps to one. */
const TAVILY_COUNTRY: Partial<Record<NameCheckTerritory, string>> = { de: 'germany' };

async function searchTavily(
	phrase: string,
	territory: NameCheckTerritory,
	apiKey: string,
	ctx: NameSourceContext,
): Promise<WebSearchHit[]> {
	const response = await fetchJson<TavilyResponse>({
		url: 'https://api.tavily.com/search',
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
		body: JSON.stringify({
			query: phrase,
			max_results: RESULT_COUNT,
			search_depth: 'basic',
			include_answer: false,
			// Without this Tavily answers semantically: pages *about* similar names count as usage.
			exact_match: true,
			...(TAVILY_COUNTRY[territory] ? { country: TAVILY_COUNTRY[territory] } : {}),
		}),
		signal: ctx.signal,
		fetch: ctx.fetch,
	});
	return (response.body?.results ?? [])
		.filter((hit): hit is { title: string; url: string; content?: string } => !!hit.title && !!hit.url)
		.map((hit) => ({ title: hit.title, url: hit.url, snippet: hit.content ?? null }));
}

async function searchBrave(phrase: string, apiKey: string, ctx: NameSourceContext): Promise<WebSearchHit[]> {
	const response = await fetchJson<BraveResponse>({
		url: `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(phrase)}&count=${RESULT_COUNT}`,
		headers: { 'x-subscription-token': apiKey },
		signal: ctx.signal,
		fetch: ctx.fetch,
	});
	return (response.body?.web?.results ?? [])
		.filter((hit): hit is { title: string; url: string; description?: string } => !!hit.title && !!hit.url)
		.map((hit) => ({ title: hit.title, url: hit.url, snippet: hit.description ?? null }));
}

export const webSource: NameSource = {
	id: 'web',
	kind: 'web',
	territories: NAME_CHECK_TERRITORIES,
	manualUrl: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(`"${query.raw}"`)}`,
	configured: (credentials) => webSearchVendor(credentials) !== null,
	async search(query, ctx) {
		const phrase = `"${query.raw}"`;
		const vendor = webSearchVendor(ctx.credentials);
		if (vendor === 'tavily' && ctx.credentials.tavilyApiKey) {
			return toWebDrafts(await searchTavily(phrase, query.territory, ctx.credentials.tavilyApiKey, ctx));
		}
		if (vendor === 'brave' && ctx.credentials.braveApiKey) {
			return toWebDrafts(await searchBrave(phrase, ctx.credentials.braveApiKey, ctx));
		}
		throw new NameSourceError('credentials_missing', 'no web search vendor is connected');
	},
};
