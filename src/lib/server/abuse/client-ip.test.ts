import { describe, expect, it } from 'vitest';
import { normalizeIpKey } from './client-ip';

describe('normalizeIpKey', () => {
	it('keys IPv4 per address', () => {
		expect(normalizeIpKey('203.0.113.7')).toBe('203.0.113.7');
	});

	// The bug: every address in a client's own /64 used to get its own bucket,
	// so a single residential allocation had 2^64 of them.
	it('collapses an entire IPv6 /64 to one bucket', () => {
		const sameAllocation = [
			'2001:db8:abcd:1234::1',
			'2001:db8:abcd:1234::2',
			'2001:db8:abcd:1234:ffff:ffff:ffff:ffff',
			'2001:db8:abcd:1234:dead:beef:cafe:1',
		];
		const keys = new Set(sameAllocation.map((a) => normalizeIpKey(a)));
		expect(keys.size).toBe(1);
	});

	it('keeps distinct /64s in distinct buckets', () => {
		expect(normalizeIpKey('2001:db8:abcd:1234::1')).not.toBe(normalizeIpKey('2001:db8:abcd:9999::1'));
	});

	it('folds spelling variants of one address onto one key', () => {
		const key = normalizeIpKey('2001:0db8:abcd:1234::1');
		expect(normalizeIpKey('2001:DB8:ABCD:1234::1')).toBe(key); // case
		expect(normalizeIpKey('2001:db8:abcd:1234::1%eth0')).toBe(key); // zone id
		expect(normalizeIpKey('[2001:db8:abcd:1234::1]')).toBe(key); // bracketed
		expect(normalizeIpKey('  2001:db8:abcd:1234::1  ')).toBe(key); // whitespace
	});

	it('treats IPv4-mapped IPv6 as the underlying IPv4', () => {
		expect(normalizeIpKey('::ffff:203.0.113.7')).toBe('203.0.113.7');
		expect(normalizeIpKey('::ffff:203.0.113.7')).toBe(normalizeIpKey('203.0.113.7'));
	});

	it('handles compressed and loopback forms without throwing', () => {
		expect(normalizeIpKey('::1')).toBe('0:0:0:0::/64');
		expect(normalizeIpKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
		expect(normalizeIpKey('fe80::')).toBe('fe80:0:0:0::/64');
	});

	it('returns null for nullish and empty input', () => {
		expect(normalizeIpKey(null)).toBeNull();
		expect(normalizeIpKey(undefined)).toBeNull();
		expect(normalizeIpKey('')).toBeNull();
		expect(normalizeIpKey('   ')).toBeNull();
	});

	it('is idempotent', () => {
		for (const ip of ['203.0.113.7', '2001:db8:abcd:1234::1', '::ffff:203.0.113.7']) {
			const once = normalizeIpKey(ip);
			expect(normalizeIpKey(once)).toBe(once);
		}
	});
});
