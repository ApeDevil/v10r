/**
 * A name source is one upstream the check can ask — a trade mark registry, a company
 * register, RDAP, a web search — or, when the upstream offers no automated access, the
 * link a person follows instead.
 *
 * Not "adapter": in this repo `*.adapter.ts` is a domain-local transport seam. Not bare
 * "source": that word is spoken for by turn provenance. A source declares the territories
 * it covers and ALWAYS a manual URL, so every coverage row can send the user to the
 * authoritative record whether the automated search ran or not.
 */
import type {
	CompanyNameMatch,
	DomainNameMatch,
	NameMatchKind,
	NameSourceId,
	TrademarkNameMatch,
	WebNameMatch,
} from '$lib/name-check/report';
import type { NameCheckTerritory } from '$lib/schemas/name-check';
import type { Deadline } from '$lib/server/http/deadline';
import type { NameCheckQuery } from './query';

export interface EuipoCredentials {
	clientId: string;
	clientSecret: string;
	apiBase: string;
	tokenUrl: string;
}

/** Every upstream credential the sources may need. Missing ⇒ that source reports `credentials_missing`. */
export interface NameSourceCredentials {
	euipo: EuipoCredentials | null;
	tavilyApiKey: string | null;
	braveApiKey: string | null;
}

export const NO_CREDENTIALS: NameSourceCredentials = { euipo: null, tavilyApiKey: null, braveApiKey: null };

/** What a source returns: the match without the fields the orchestrator derives. */
type Draft<T> = Omit<T, 'similarity' | 'territoryRelevance' | 'retrievedAt'>;
export type TrademarkDraft = Draft<Omit<TrademarkNameMatch, 'categoryRelevance'>>;
export type CompanyDraft = Draft<CompanyNameMatch>;
export type DomainDraft = Draft<DomainNameMatch>;
export type WebDraft = Draft<WebNameMatch>;
export type NameMatchDraft = TrademarkDraft | CompanyDraft | DomainDraft | WebDraft;

export interface NameSourceContext {
	/** This source's own budget — a child of the fan-out's. */
	deadline: Deadline;
	/** Fires when that budget does; pass it to every fetch. */
	signal: AbortSignal;
	credentials: NameSourceCredentials;
	fetch: typeof fetch;
	now: () => Date;
	/** DNS delegation lookup, injected so the domain source is testable without a network. */
	resolveNs: (host: string) => Promise<string[]>;
}

export interface NameSource {
	id: NameSourceId;
	kind: NameMatchKind;
	territories: readonly NameCheckTerritory[];
	/** The official search a person can run — shown on every coverage row. */
	manualUrl(query: NameCheckQuery): string;
	/** Whether the credentials this source needs are present. Omitted ⇒ needs none. */
	configured?(credentials: NameSourceCredentials): boolean;
	/** Omitted ⇒ manual-only: the registry offers no automated access we may use. */
	search?(query: NameCheckQuery, ctx: NameSourceContext): Promise<NameMatchDraft[]>;
}
