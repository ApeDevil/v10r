/**
 * EUIPO — the EU trade mark register, through its official API.
 *
 * The one authoritative trade mark source the check can query automatically. Access is
 * an OAuth 2.0 client-credentials app registered on dev.euipo.europa.eu; the gateway
 * wants the client id repeated in `X-IBM-Client-Id` beside the bearer token. The defaults
 * below are the production hosts from the API's own OpenAPI definition (`servers[0].url`
 * and `clientCredentials.tokenUrl` on the Trademark Search product page); the Sandbox
 * portal is a separate environment with `api-sandbox` / `auth-sandbox` hosts, which is why
 * both are part of the saved connection. A wrong host degrades to `unavailable` with the
 * manual link, never to a wrong answer.
 *
 * Two RSQL queries per check: the name as a contained verbal element, and a prefix of it,
 * so "Velor*" surfaces "Veloro" for the similarity engine to grade. Without credentials
 * the source reports `credentials_missing`; the check still runs everything else.
 */
import { NAME_CHECK_TERRITORIES } from '$lib/schemas/name-check';
import { NameSourceError } from '../errors';
import { fetchJson } from '../fetch-json';
import type { EuipoCredentials, NameSource, NameSourceContext, TrademarkDraft } from '../name-source';

export const EUIPO_DEFAULT_API_BASE = 'https://api.euipo.europa.eu/trademark-search';
export const EUIPO_DEFAULT_TOKEN_URL = 'https://euipo.europa.eu/cas-server-webapp/oidc/accessToken';

const PAGE_SIZE = 50;
/** Refresh a token this long before the gateway would reject it. */
const TOKEN_SLACK_MS = 30_000;

/** Statuses that mean the mark no longer blocks anyone. Anything else is treated as live. */
const INACTIVE_STATUSES = new Set([
	'EXPIRED',
	'WITHDRAWN',
	'REFUSED',
	'CANCELLED',
	'REJECTED',
	'SURRENDERED',
	'REVOKED',
	'ABANDONED',
	'INVALIDATED',
	'LAPSED',
	'CONVERTED',
]);

interface EuipoTrademark {
	applicationNumber?: string;
	wordMarkSpecification?: { verbalElement?: string };
	markName?: string;
	verbalElement?: string;
	name?: string;
	status?: string;
	applicants?: Array<{ name?: string }>;
	niceClasses?: Array<number | string>;
	niceClassification?: Array<number | string>;
}

interface EuipoSearchResponse {
	trademarks?: EuipoTrademark[];
	content?: EuipoTrademark[];
	items?: EuipoTrademark[];
	data?: EuipoTrademark[];
}

interface TokenResponse {
	access_token?: string;
	expires_in?: number;
}

/** One token per client id per instance; a serverless cold start simply fetches a fresh one. */
const tokens = new Map<string, { token: string; expiresAt: number }>();

/** Test seam. */
export function resetEuipoTokens(): void {
	tokens.clear();
}

export function recordUrl(applicationNumber: string): string {
	return `https://euipo.europa.eu/eSearch/#basic/1+1+1+1/50+50+50+50/${encodeURIComponent(applicationNumber)}`;
}

/** Pure mapping, fixture-tested; tolerant of the wrapper key the gateway chooses. */
export function toEuipoDrafts(raw: EuipoSearchResponse | EuipoTrademark[] | null): TrademarkDraft[] {
	const items = Array.isArray(raw) ? raw : (raw?.trademarks ?? raw?.content ?? raw?.items ?? raw?.data ?? []);
	const drafts: TrademarkDraft[] = [];
	for (const item of items) {
		const label = (
			item.wordMarkSpecification?.verbalElement ??
			item.markName ??
			item.verbalElement ??
			item.name
		)?.trim();
		if (!label) continue;
		const status = item.status?.toUpperCase() ?? null;
		const applicationNumber = item.applicationNumber ?? null;
		const niceClasses = (item.niceClasses ?? item.niceClassification ?? [])
			.map((cls) => Number(cls))
			.filter((cls) => Number.isInteger(cls) && cls >= 1 && cls <= 45);
		drafts.push({
			sourceId: 'euipo',
			kind: 'trademark',
			label,
			aliases: [],
			jurisdiction: 'EM',
			externalId: applicationNumber,
			url: applicationNumber ? recordUrl(applicationNumber) : null,
			status,
			active: status === null ? true : !INACTIVE_STATUSES.has(status),
			owner: item.applicants?.[0]?.name?.trim() ?? null,
			niceClasses,
		});
	}
	return drafts;
}

/** RSQL string literals: keep letters, digits and spaces so the name cannot become syntax. */
function rsqlTerm(value: string): string {
	return value.replace(/[^\p{L}\p{N} ]+/gu, '').trim();
}

/** The queries one check sends — exported so the tests can pin them. */
export function euipoQueries(canonical: string, compact: string): string[] {
	const term = rsqlTerm(canonical);
	if (!term) return [];
	const queries = [`wordMarkSpecification.verbalElement==*${term}*`];
	const prefix = rsqlTerm(compact).slice(0, Math.max(4, compact.length - 1));
	if (prefix.length >= 4 && prefix !== compact) queries.push(`wordMarkSpecification.verbalElement==${prefix}*`);
	return queries;
}

/**
 * Two requests can refuse a credential — the token endpoint (wrong secret) and the API
 * gateway (no approved subscription) — and both answer 401. The step is put in front of
 * the message so a connection test can show which one, without a vendor body.
 */
function atStep(step: 'token endpoint' | 'trademark search', err: unknown): unknown {
	return err instanceof NameSourceError
		? new NameSourceError(err.kind, `${step}: ${err.message}`, err.retryAfterSeconds)
		: err;
}

async function accessToken(credentials: EuipoCredentials, ctx: NameSourceContext): Promise<string> {
	const cached = tokens.get(credentials.clientId);
	if (cached && cached.expiresAt > Date.now() + TOKEN_SLACK_MS) return cached.token;

	const body = new URLSearchParams({
		grant_type: 'client_credentials',
		scope: 'uid',
		client_id: credentials.clientId,
		client_secret: credentials.clientSecret,
	});
	const response = await fetchJson<TokenResponse>({
		url: credentials.tokenUrl,
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: body.toString(),
		signal: ctx.signal,
		fetch: ctx.fetch,
	}).catch((err: unknown) => {
		throw atStep('token endpoint', err);
	});
	const token = response.body?.access_token;
	if (!token) throw new NameSourceError('unavailable', 'token endpoint: response carried no access_token');
	const expiresIn = response.body?.expires_in ?? 3600;
	tokens.set(credentials.clientId, { token, expiresAt: Date.now() + expiresIn * 1000 });
	return token;
}

export const euipoSource: NameSource = {
	id: 'euipo',
	kind: 'trademark',
	territories: NAME_CHECK_TERRITORIES,
	manualUrl: (query) => `https://euipo.europa.eu/eSearch/#basic/1+1+1+1/50+50+50+50/${encodeURIComponent(query.raw)}`,
	configured: (credentials) => credentials.euipo !== null,
	async search(query, ctx) {
		const credentials = ctx.credentials.euipo;
		if (!credentials) throw new NameSourceError('credentials_missing', 'EUIPO client credentials are not configured');

		const token = await accessToken(credentials, ctx);
		const headers = {
			authorization: `Bearer ${token}`,
			'x-ibm-client-id': credentials.clientId,
		};

		const pages = await Promise.all(
			euipoQueries(query.normalized.canonical, query.normalized.compact).map((rsql) =>
				fetchJson<EuipoSearchResponse>({
					url: `${credentials.apiBase}/trademarks?query=${encodeURIComponent(rsql)}&size=${PAGE_SIZE}&page=0`,
					headers,
					signal: ctx.signal,
					fetch: ctx.fetch,
				}).catch((err: unknown) => {
					// A rejected token is stale, not wrong: forget it so the next check re-authenticates.
					if (err instanceof NameSourceError && err.message === 'HTTP 401') tokens.delete(credentials.clientId);
					throw atStep('trademark search', err);
				}),
			),
		);
		return pages.flatMap((page) => toEuipoDrafts(page.body));
	},
};
