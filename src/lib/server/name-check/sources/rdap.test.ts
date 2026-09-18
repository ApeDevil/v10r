import { describe, expect, it, vi } from 'vitest';
import { startDeadline } from '$lib/server/http/deadline';
import { type NameSourceContext, NO_CREDENTIALS } from '../name-source';
import { toNameCheckQuery } from '../query';
import { parseRdapBootstrap, RDAP_STATIC_BOOTSTRAP, rdapBaseFor, rdapSource } from './rdap';

vi.mock('$lib/server/cache/client', () => ({ redis: null }));
vi.mock('$lib/server/platform/after-response', () => ({ deferAfterResponse: vi.fn() }));

const BOOTSTRAP = {
	services: [
		[['com', 'net'], ['https://rdap.verisign.com/com/v1/']],
		[['xyz'], ['http://insecure.example/', 'https://rdap.centralnic.com/xyz/']],
	],
};

function context(
	fetchImpl: typeof fetch,
	resolveNs: NameSourceContext['resolveNs'] = async () => [],
): NameSourceContext {
	const deadline = startDeadline(2_000);
	return {
		deadline,
		signal: deadline.signal(),
		credentials: NO_CREDENTIALS,
		fetch: fetchImpl,
		now: () => new Date(),
		resolveNs,
	};
}

describe('bootstrap', () => {
	it('parses the IANA service list, preferring https and normalising the trailing slash', () => {
		expect(parseRdapBootstrap(BOOTSTRAP)).toEqual({
			com: 'https://rdap.verisign.com/com/v1/',
			net: 'https://rdap.verisign.com/com/v1/',
			xyz: 'https://rdap.centralnic.com/xyz/',
		});
		expect(parseRdapBootstrap(null)).toEqual({});
	});

	it('lets a hand override win, then the live file, then the static copy', () => {
		expect(rdapBaseFor('de', {})).toBe('https://rdap.denic.de/');
		expect(rdapBaseFor('com', { com: 'https://live.example/' })).toBe('https://live.example/');
		expect(rdapBaseFor('org', {})).toBe(RDAP_STATIC_BOOTSTRAP.org);
		expect(rdapBaseFor('eu', {})).toBeNull();
	});
});

describe('rdapSource.search', () => {
	it('maps 200, 404 and errors to registration statuses and uses DNS evidence for .eu', async () => {
		const fetchImpl: typeof fetch = async (input) => {
			const url = String(input);
			if (url.endsWith('/rdap/dns.json')) return Response.json(BOOTSTRAP);
			if (url.includes('velora.com')) {
				return Response.json({
					events: [{ eventAction: 'registration', eventDate: '2019-03-01T00:00:00Z' }],
					entities: [{ roles: ['registrar'], vcardArray: ['vcard', [['fn', {}, 'text', 'Example Registrar']]] }],
				});
			}
			if (url.includes('velora.net')) return new Response('', { status: 404 });
			if (url.includes('velora.de')) return new Response('', { status: 500 });
			return new Response('', { status: 404 });
		};
		const resolveNs = async (host: string) => (host === 'velora.eu' ? ['ns1.example.'] : []);

		const rows = await rdapSource.search?.(
			toNameCheckQuery({ query: 'Velora', territory: 'de', category: null }),
			context(fetchImpl, resolveNs),
		);
		const byDomain = Object.fromEntries((rows ?? []).map((row) => [row.label, row]));

		expect(byDomain['velora.com']).toMatchObject({
			registration: 'registered',
			registrar: 'Example Registrar',
			registeredAt: '2019-03-01T00:00:00Z',
		});
		expect(byDomain['velora.net']?.kind === 'domain' && byDomain['velora.net'].registration).toBe('not_registered');
		expect(byDomain['velora.de']?.kind === 'domain' && byDomain['velora.de'].registration).toBe('unknown');
		expect(byDomain['velora.eu']?.kind === 'domain' && byDomain['velora.eu'].registration).toBe('dns_records');
		// .io has no server in this bootstrap, in the overrides, or in the static copy.
		expect(byDomain['velora.io']?.kind === 'domain' && byDomain['velora.io'].registration).toBe('lookup_unavailable');
		expect(rows?.every((row) => row.aliases[0] === 'velora')).toBe(true);
	});

	it('reports every variant as lookup-unavailable for a name that is not a DNS label', async () => {
		const fetchImpl = vi.fn<typeof fetch>();
		const rows = await rdapSource.search?.(
			toNameCheckQuery({ query: 'Велора', territory: 'eu', category: null }),
			context(fetchImpl),
		);
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(rows?.every((row) => row.kind === 'domain' && row.registration === 'lookup_unavailable')).toBe(true);
	});
});
