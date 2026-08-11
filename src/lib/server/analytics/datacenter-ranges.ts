/**
 * Published datacenter / relay IP prefix feeds — the raw material for
 * `sessions.ip_class`.
 *
 * Unlike the crawler feeds (`bot-ranges.ts`), these operators never agreed on a
 * document shape: AWS and Oracle publish their own JSON layouts, DigitalOcean
 * and Apple publish CSV, Cloudflare publishes bare text. So each feed carries
 * its own parser over the raw response text, and everything funnels through
 * `isValidPrefix` before it can reach a `::cidr` cast.
 *
 * ## What this list is honest about
 *
 * It classifies what the operators PUBLISH. Alibaba and Tencent — prominent in
 * the measured crawler wave — publish nothing machine-readable, so their
 * traffic classifies as `unknown`, not `datacenter`. The signal ranks the
 * unconfirmed bucket; it was never going to be exhaustive, and pretending
 * otherwise is how a ranking becomes a silent exclusion.
 *
 * `icloud_relay` is the deliberate counterweight: Apple publishes those egress
 * ranges precisely so relay users are NOT mistaken for hosting traffic, and
 * warns that many users share one egress IP. It rides commercial cloud address
 * space, which is why the containment CASE checks relay before datacenter.
 */

import type { DcRangeSource } from '$lib/server/db/schema/analytics/dc-ranges';
import { isValidPrefix, parsePrefixes } from './bot-ranges';

export interface DatacenterRangeFeed {
	source: DcRangeSource;
	urls: readonly string[];
	/** Parse ONE document's raw text into CIDR strings (pre-`isValidPrefix`). */
	parse: (payload: string) => string[];
}

/** Wrap a JSON-document parser so malformed JSON yields [] instead of throwing. */
function fromJson(extract: (doc: unknown) => string[]): (payload: string) => string[] {
	return (payload) => {
		try {
			return extract(JSON.parse(payload)).filter(isValidPrefix);
		} catch {
			return [];
		}
	};
}

/** AWS shape: { prefixes: [{ ip_prefix }], ipv6_prefixes: [{ ipv6_prefix }] } */
export const parseAwsRanges = fromJson((doc) => {
	if (typeof doc !== 'object' || doc === null) return [];
	const { prefixes, ipv6_prefixes } = doc as { prefixes?: unknown; ipv6_prefixes?: unknown };
	const out: string[] = [];
	if (Array.isArray(prefixes)) {
		for (const entry of prefixes) {
			const value = (entry as { ip_prefix?: unknown })?.ip_prefix;
			if (typeof value === 'string') out.push(value);
		}
	}
	if (Array.isArray(ipv6_prefixes)) {
		for (const entry of ipv6_prefixes) {
			const value = (entry as { ipv6_prefix?: unknown })?.ipv6_prefix;
			if (typeof value === 'string') out.push(value);
		}
	}
	return out;
});

/** GCP publishes the Google crawler-feed shape — `parsePrefixes` covers it. */
export const parseGcpRanges = fromJson(parsePrefixes);

/** Oracle shape: { regions: [{ cidrs: [{ cidr }] }] } */
export const parseOracleRanges = fromJson((doc) => {
	if (typeof doc !== 'object' || doc === null) return [];
	const regions = (doc as { regions?: unknown }).regions;
	if (!Array.isArray(regions)) return [];
	const out: string[] = [];
	for (const region of regions) {
		const cidrs = (region as { cidrs?: unknown })?.cidrs;
		if (!Array.isArray(cidrs)) continue;
		for (const entry of cidrs) {
			const value = (entry as { cidr?: unknown })?.cidr;
			if (typeof value === 'string') out.push(value);
		}
	}
	return out;
});

/** CSV with the prefix in column 0 (DigitalOcean geo feed, Apple relay egress). */
export function parseCsvPrefixColumn(payload: string): string[] {
	const out: string[] = [];
	for (const line of payload.split('\n')) {
		const first = line.split(',')[0]?.trim();
		if (first && isValidPrefix(first)) out.push(first);
	}
	return out;
}

/** Bare text, one prefix per line (Cloudflare ips-v4 / ips-v6). */
export function parsePrefixLines(payload: string): string[] {
	return payload
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && isValidPrefix(line));
}

export const DATACENTER_RANGE_FEEDS: readonly DatacenterRangeFeed[] = [
	{ source: 'aws', urls: ['https://ip-ranges.amazonaws.com/ip-ranges.json'], parse: parseAwsRanges },
	{ source: 'gcp', urls: ['https://www.gstatic.com/ipranges/cloud.json'], parse: parseGcpRanges },
	{
		source: 'oracle',
		urls: ['https://docs.oracle.com/en-us/iaas/tools/public_ip_ranges.json'],
		parse: parseOracleRanges,
	},
	{ source: 'digitalocean', urls: ['https://digitalocean.com/geo/google.csv'], parse: parseCsvPrefixColumn },
	{
		source: 'cloudflare',
		urls: ['https://www.cloudflare.com/ips-v4', 'https://www.cloudflare.com/ips-v6'],
		parse: parsePrefixLines,
	},
	{
		source: 'icloud_relay',
		urls: ['https://mask-api.icloud.com/egress-ip-ranges.csv'],
		parse: parseCsvPrefixColumn,
	},
];
