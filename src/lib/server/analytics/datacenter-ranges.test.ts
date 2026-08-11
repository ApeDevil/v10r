/**
 * Datacenter/relay feed parsers + the write-time ip_class containment.
 *
 * Parser fixtures are miniature copies of each operator's real document shape —
 * the shapes are the contract, and a silent parse-to-empty is exactly the
 * failure the refresh job treats as "feed changed under us".
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { datacenterIpRanges, sessions } from '$lib/server/db/schema/analytics';
import {
	parseAwsRanges,
	parseCsvPrefixColumn,
	parseGcpRanges,
	parseOracleRanges,
	parsePrefixLines,
} from './datacenter-ranges';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { db } = await import('$lib/server/db');
const { upsertSession } = await import('$lib/server/db/analytics/mutations');

afterAll(async () => {
	await testClient?.close();
});

// ── Parsers ──────────────────────────────────────────────────────────────────

describe('feed parsers', () => {
	it('AWS: ip_prefix + ipv6_prefix arrays', () => {
		const doc = JSON.stringify({
			syncToken: '123',
			prefixes: [{ ip_prefix: '3.0.0.0/9', region: 'ap-southeast-1', service: 'AMAZON' }, { bogus: true }],
			ipv6_prefixes: [{ ipv6_prefix: '2600:1f00::/24' }],
		});
		expect(parseAwsRanges(doc)).toEqual(['3.0.0.0/9', '2600:1f00::/24']);
	});

	it('GCP: the Google crawler-feed shape', () => {
		const doc = JSON.stringify({
			prefixes: [{ ipv4Prefix: '34.0.0.0/10' }, { ipv6Prefix: '2600:1900::/28' }],
		});
		expect(parseGcpRanges(doc)).toEqual(['34.0.0.0/10', '2600:1900::/28']);
	});

	it('Oracle: regions[].cidrs[].cidr', () => {
		const doc = JSON.stringify({
			regions: [
				{ region: 'eu-frankfurt-1', cidrs: [{ cidr: '130.61.0.0/16', tags: ['OCI'] }] },
				{ region: 'us-ashburn-1', cidrs: [{ cidr: '129.213.0.0/16' }] },
			],
		});
		expect(parseOracleRanges(doc)).toEqual(['130.61.0.0/16', '129.213.0.0/16']);
	});

	it('CSV column 0 (DigitalOcean geo / Apple relay egress)', () => {
		const csv = '104.131.0.0/16,US,NY,"New York",10001\n172.224.224.0/27,US,CA,,\nnot-a-prefix,XX\n';
		expect(parseCsvPrefixColumn(csv)).toEqual(['104.131.0.0/16', '172.224.224.0/27']);
	});

	it('bare prefix lines (Cloudflare)', () => {
		expect(parsePrefixLines('173.245.48.0/20\n103.21.244.0/22\n\ngarbage\n')).toEqual([
			'173.245.48.0/20',
			'103.21.244.0/22',
		]);
	});

	it('malformed JSON parses to empty, never throws', () => {
		expect(parseAwsRanges('{nope')).toEqual([]);
		expect(parseOracleRanges('null')).toEqual([]);
	});
});

// ── Write-time containment (PGlite) ──────────────────────────────────────────

describe('upsertSession ip_class containment', () => {
	beforeEach(async () => {
		await db.delete(sessions);
		await db.delete(datacenterIpRanges);
	});

	it('classifies a datacenter IP, a relay IP (relay wins), and unknown', async () => {
		await db.insert(datacenterIpRanges).values([
			{ source: 'aws', prefix: '3.0.0.0/9' },
			// deliberate overlap: the relay range sits INSIDE cloud space
			{ source: 'aws', prefix: '172.224.0.0/12' },
			{ source: 'icloud_relay', prefix: '172.224.224.0/27' },
		]);

		await upsertSession({ id: 's_dc', visitorId: 'v_ip1', entryPath: '/', clientIp: '3.5.1.2' });
		await upsertSession({ id: 's_relay', visitorId: 'v_ip2', entryPath: '/', clientIp: '172.224.224.5' });
		await upsertSession({ id: 's_res', visitorId: 'v_ip3', entryPath: '/', clientIp: '84.150.1.2' });

		const rows = Object.fromEntries((await db.select().from(sessions)).map((r) => [r.id, r.ipClass]));
		expect(rows).toEqual({ s_dc: 'datacenter', s_relay: 'icloud_relay', s_res: 'unknown' });
	});

	it('empty range table yields NULL — absence of the feed is not a finding', async () => {
		await upsertSession({ id: 's_null', visitorId: 'v_ip4', entryPath: '/', clientIp: '3.5.1.2' });
		const rows = await db.select().from(sessions);
		expect(rows[0].ipClass).toBeNull();
	});

	it('no clientIp leaves ip_class untouched, and a later classification never overwrites', async () => {
		await db.insert(datacenterIpRanges).values([{ source: 'aws', prefix: '3.0.0.0/9' }]);

		await upsertSession({ id: 's_keep', visitorId: 'v_ip5', entryPath: '/' });
		let rows = await db.select().from(sessions);
		expect(rows[0].ipClass).toBeNull();

		// backfill: first classification wins…
		await upsertSession({ id: 's_keep', visitorId: 'v_ip5', entryPath: '/', clientIp: '3.5.1.2' });
		rows = await db.select().from(sessions);
		expect(rows[0].ipClass).toBe('datacenter');

		// …and a different-looking later IP does not replace it
		await upsertSession({ id: 's_keep', visitorId: 'v_ip5', entryPath: '/', clientIp: '84.150.1.2' });
		rows = await db.select().from(sessions);
		expect(rows[0].ipClass).toBe('datacenter');
	});

	it('unwraps an IPv4-mapped IPv6 before containment — the family trap', async () => {
		await db.insert(datacenterIpRanges).values([{ source: 'aws', prefix: '3.0.0.0/9' }]);
		await upsertSession({ id: 's_map', visitorId: 'v_ip6', entryPath: '/', clientIp: '::ffff:3.5.1.2' });
		const rows = await db.select().from(sessions);
		expect(rows[0].ipClass).toBe('datacenter');
	});
});
