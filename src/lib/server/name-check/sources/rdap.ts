/**
 * Domains — RDAP where a registry publishes it, DNS evidence where it does not, and an
 * honest "lookup unavailable" everywhere else.
 *
 * The IANA bootstrap file maps a TLD to its RDAP server and is cached for a day with a
 * static copy as the fallback; `.de` is added by hand because DENIC's pilot server is
 * public but not yet listed. `.eu` has no RDAP at all, so its row reports only what the
 * DNS says: delegated name servers mean "in use — likely registered", their absence means
 * "unknown", because an undelegated domain can still be somebody's.
 *
 * Answers: 200 → registered, 404 → not registered, anything else → unknown. A registered
 * domain is a fact about the domain, never about the trade mark — the report keeps them
 * in separate sections for that reason.
 */
import { resolveNs } from 'node:dns/promises';
import { NAME_CHECK_TERRITORIES } from '$lib/schemas/name-check';
import { definePolicy, readThrough } from '$lib/server/cache';
import { DOMAIN_TLDS, RDAP_BOOTSTRAP_TTL_SECONDS, RDAP_LOOKUP_MS } from '../config';
import { fetchJson } from '../fetch-json';
import type { DomainDraft, NameSource, NameSourceContext } from '../name-source';

export const RDAP_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';

/** The bootstrap as of 2026-09-09 — what the check uses when IANA is unreachable. */
export const RDAP_STATIC_BOOTSTRAP: Readonly<Record<string, string>> = {
	com: 'https://rdap.verisign.com/com/v1/',
	net: 'https://rdap.verisign.com/net/v1/',
	org: 'https://rdap.publicinterestregistry.org/rdap/',
	app: 'https://pubapi.registry.google/rdap/',
	dev: 'https://pubapi.registry.google/rdap/',
	ai: 'https://rdap.nic.ai/',
	info: 'https://rdap.nic.info/',
	biz: 'https://rdap.nic.biz/',
	uk: 'https://rdap.nominet.uk/uk/',
	fr: 'https://rdap.nic.fr/',
	nl: 'https://rdap.sidn.nl/',
};

/** Public servers the bootstrap does not list. DENIC's is a pilot without a service level. */
export const RDAP_OVERRIDES: Readonly<Record<string, string>> = {
	de: 'https://rdap.denic.de/',
};

/** TLDs with no RDAP server where a DNS delegation is the best public evidence. */
const DNS_EVIDENCE_TLDS = new Set(['eu']);

const BOOTSTRAP_POLICY = definePolicy({
	namespace: 'name-check-rdap-bootstrap',
	ttl: RDAP_BOOTSTRAP_TTL_SECONDS,
	staleFor: RDAP_BOOTSTRAP_TTL_SECONDS,
	scope: 'shared',
});

/** A hostname label: what the compact name must be to become `<label>.<tld>`. */
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

interface RdapBootstrapFile {
	services?: Array<[string[], string[]]>;
}

interface RdapDomain {
	status?: string[];
	events?: Array<{ eventAction?: string; eventDate?: string }>;
	entities?: Array<{ roles?: string[]; vcardArray?: [string, Array<[string, unknown, string, unknown]>] }>;
}

export async function resolveNsViaSystem(host: string): Promise<string[]> {
	return resolveNs(host);
}

/** `services` is a list of `[[tlds], [base urls]]` pairs; the first https base wins. */
export function parseRdapBootstrap(raw: unknown): Record<string, string> {
	const servers: Record<string, string> = {};
	const services = (raw as RdapBootstrapFile | null)?.services ?? [];
	for (const service of services) {
		const [tlds, urls] = service;
		const base = urls?.find((url) => url.startsWith('https://')) ?? urls?.[0];
		if (!base) continue;
		for (const tld of tlds ?? []) servers[tld.toLowerCase()] = base.endsWith('/') ? base : `${base}/`;
	}
	return servers;
}

export function rdapBaseFor(tld: string, bootstrap: Readonly<Record<string, string>>): string | null {
	return RDAP_OVERRIDES[tld] ?? bootstrap[tld] ?? RDAP_STATIC_BOOTSTRAP[tld] ?? null;
}

function registrarOf(domain: RdapDomain): string | null {
	const registrar = domain.entities?.find((entity) => entity.roles?.includes('registrar'));
	const fn = registrar?.vcardArray?.[1]?.find((entry) => entry[0] === 'fn');
	return typeof fn?.[3] === 'string' ? fn[3] : null;
}

function registeredAtOf(domain: RdapDomain): string | null {
	return domain.events?.find((event) => event.eventAction === 'registration')?.eventDate ?? null;
}

function lookupUrl(domain: string, tld: string): string {
	if (tld === 'de') return 'https://www.denic.de/en/webwhois/';
	if (tld === 'eu') return 'https://whois.eurid.eu/en/';
	return `https://lookup.icann.org/en/lookup?name=${encodeURIComponent(domain)}`;
}

export function domainDraft(label: string, tld: string, fields: Partial<DomainDraft> = {}): DomainDraft {
	const domain = `${label}.${tld}`;
	return {
		sourceId: 'rdap',
		kind: 'domain',
		label: domain,
		// The registrable label is what similarity grades; the domain itself would score as a token match.
		aliases: [label],
		jurisdiction: null,
		externalId: domain,
		url: lookupUrl(domain, tld),
		domain,
		registration: 'lookup_unavailable',
		registrar: null,
		registeredAt: null,
		...fields,
	};
}

async function loadBootstrap(ctx: NameSourceContext): Promise<Readonly<Record<string, string>>> {
	try {
		const read = await readThrough(BOOTSTRAP_POLICY, { id: 'iana-dns' }, () =>
			ctx.deadline.child(RDAP_LOOKUP_MS).run(async (signal) => {
				const response = await fetchJson<unknown>({ url: RDAP_BOOTSTRAP_URL, signal, fetch: ctx.fetch });
				const parsed = parseRdapBootstrap(response.body);
				if (Object.keys(parsed).length === 0) throw new Error('empty bootstrap');
				return parsed;
			}),
		);
		return read.value;
	} catch {
		return RDAP_STATIC_BOOTSTRAP;
	}
}

async function lookupOne(
	label: string,
	tld: string,
	bootstrap: Readonly<Record<string, string>>,
	ctx: NameSourceContext,
): Promise<DomainDraft> {
	const domain = `${label}.${tld}`;
	const base = rdapBaseFor(tld, bootstrap);

	if (base) {
		const response = await ctx.deadline.child(RDAP_LOOKUP_MS).run((signal) =>
			fetchJson<RdapDomain>({
				url: `${base}domain/${domain}`,
				headers: { accept: 'application/rdap+json, application/json' },
				signal,
				fetch: ctx.fetch,
				pass: [404],
			}),
		);
		if (response.status === 404) return domainDraft(label, tld, { registration: 'not_registered' });
		const record = response.body ?? {};
		return domainDraft(label, tld, {
			registration: 'registered',
			registrar: registrarOf(record),
			registeredAt: registeredAtOf(record),
		});
	}

	if (DNS_EVIDENCE_TLDS.has(tld)) {
		const servers = await ctx.deadline.child(RDAP_LOOKUP_MS).run(() => ctx.resolveNs(domain));
		return domainDraft(label, tld, { registration: servers.length > 0 ? 'dns_records' : 'unknown' });
	}

	return domainDraft(label, tld);
}

export const rdapSource: NameSource = {
	id: 'rdap',
	kind: 'domain',
	territories: NAME_CHECK_TERRITORIES,
	manualUrl: (query) =>
		`https://lookup.icann.org/en/lookup?name=${encodeURIComponent(`${query.normalized.compact}.com`)}`,
	async search(query, ctx) {
		const label = query.normalized.compact;
		if (!DNS_LABEL.test(label)) return DOMAIN_TLDS.map((tld) => domainDraft(label, tld));

		const bootstrap = await loadBootstrap(ctx);
		const rows = await Promise.allSettled(DOMAIN_TLDS.map((tld) => lookupOne(label, tld, bootstrap, ctx)));
		return rows.map((row, index) => {
			if (row.status === 'fulfilled') return row.value;
			// One registry timing out or erroring is "unknown" for that row, not a failed source.
			return domainDraft(label, DOMAIN_TLDS[index] ?? 'com', { registration: 'unknown' });
		});
	},
};
