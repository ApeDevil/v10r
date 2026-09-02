import { describe, expect, it } from 'vitest';
import { ipLimitKey, normalizeIpKey } from './ip-bucket';

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

describe('ipLimitKey', () => {
	it('buckets IPv6 by /64, not by address', () => {
		// The whole point: a client rotating inside its own allocation must not
		// get a fresh bucket per request.
		const a = ipLimitKey('2001:db8:0:1:aaaa::1');
		const b = ipLimitKey('2001:db8:0:1:bbbb::2');
		expect(a).toBe(b);
	});

	it('keeps distinct /64s apart', () => {
		expect(ipLimitKey('2001:db8:0:1::1')).not.toBe(ipLimitKey('2001:db8:0:2::1'));
	});

	it('passes IPv4 through whole', () => {
		expect(ipLimitKey('203.0.113.9')).toBe('ip:203.0.113.9');
	});

	it('gives an unknown address a real bucket instead of no limit at all', () => {
		// Several routes previously wrapped the limiter in `if (ip)`, so a missing
		// address meant unlimited requests — exactly backwards. Coarse is correct
		// here: we cannot tell those callers apart.
		expect(ipLimitKey(null)).toBe('ip:anon');
		expect(ipLimitKey(undefined)).toBe('ip:anon');
		expect(ipLimitKey('')).toBe('ip:anon');
		expect(ipLimitKey('   ')).toBe('ip:anon');
	});

	it('namespaces away from user-id buckets', () => {
		// style/pick keys by user id when signed in and by IP otherwise; without a
		// prefix the two kinds of key share one keyspace.
		expect(ipLimitKey('203.0.113.9').startsWith('ip:')).toBe(true);
	});

	it('is idempotent — re-keying its own output does not change the bucket', () => {
		const once = ipLimitKey('2001:DB8:0:1::1');
		expect(ipLimitKey('2001:db8:0:1:0:0:0:1')).toBe(once);
	});
});
