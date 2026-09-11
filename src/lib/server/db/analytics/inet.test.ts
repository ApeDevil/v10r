/**
 * The shape checks between third-party text and an `::inet` / `::cidr` cast.
 *
 * Pure functions over strings, no database: the cast itself is exercised by
 * `analytics/datacenter-ranges.pglite.test.ts`, which writes real prefixes and real
 * client addresses through `upsertSession`.
 */
import { describe, expect, it } from 'vitest';
import { isPlausibleIpAddress, isValidPrefix, normalizeIpForVerification } from './inet';

describe('isValidPrefix', () => {
	it.each(['192.0.2.0/24', '10.0.0.1/32', '2001:db8::/32', '::/0'])('accepts %s', (p) => {
		expect(isValidPrefix(p)).toBe(true);
	});

	it.each(['192.0.2.0', '192.0.2.0/33', '256.0.0.1/24', '2001:db8::/129', '/24', 'x/24'])('rejects %s', (p) => {
		expect(isValidPrefix(p)).toBe(false);
	});
});

describe('isPlausibleIpAddress', () => {
	it.each(['203.0.113.5', '2001:db8::1', '::1'])('accepts %s', (ip) => {
		expect(isPlausibleIpAddress(ip)).toBe(true);
	});

	it.each(['', 'localhost', '203.0.113', '999.0.0.1', '1.2.3.4.5', 'a'.repeat(50)])('rejects %s', (ip) => {
		expect(isPlausibleIpAddress(ip)).toBe(false);
	});

	it('accepts a bare IPv4-mapped IPv6 address as an address', () => {
		// Plausible as an ADDRESS; whether it can be compared is a separate question,
		// answered by normalizeIpForVerification below.
		expect(isPlausibleIpAddress('::ffff:132.196.86.42')).toBe(true);
	});

	it('rejects a /64 CIDR — the rate limiter shape, which is not an address', () => {
		// normalizeIpKey returns this for IPv6. Using it for containment would fail
		// the ::inet cast, and if it survived one it would widen every IPv6
		// comparison to an entire allocation.
		expect(isPlausibleIpAddress('2001:db8:1:2::/64')).toBe(false);
	});
});

describe('normalizeIpForVerification', () => {
	it('unwraps IPv4-mapped IPv6 to bare IPv4', () => {
		// THE bug this function exists for, confirmed against Neon on 2026-08-03:
		//   '132.196.86.42'::inet        <<= '132.196.86.0/24'::cidr → true
		//   '::ffff:132.196.86.42'::inet <<= '132.196.86.0/24'::cidr → FALSE
		// Postgres treats the mapped form as IPv6, and `<<=` is false across address
		// families — silently. Every operator publishes plain IPv4 prefixes, so an
		// unwrapped mapped address matches nothing and the verdict falls through to
		// `spoofed`: a fabricated impersonation alert against a real crawler.
		expect(normalizeIpForVerification('::ffff:132.196.86.42')).toBe('132.196.86.42');
	});

	it('strips a zone id and brackets', () => {
		expect(normalizeIpForVerification('fe80::1%eth0')).toBe('fe80::1');
		expect(normalizeIpForVerification('[2001:db8::1]')).toBe('2001:db8::1');
	});

	it('passes ordinary addresses through unchanged', () => {
		expect(normalizeIpForVerification('203.0.113.5')).toBe('203.0.113.5');
		expect(normalizeIpForVerification('2001:db8::1')).toBe('2001:db8::1');
	});

	it.each([null, undefined, '', 'not-an-ip', '2001:db8:1:2::/64'])('returns null for %j', (ip) => {
		// null must render as `unchecked` — an operational gap — and never as a
		// verdict about the caller.
		expect(normalizeIpForVerification(ip)).toBeNull();
	});
});
