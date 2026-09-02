import { describe, expect, it } from 'vitest';
import { ipInPrefix, parseIpAddress } from './ip-prefix';

describe('parseIpAddress', () => {
	it('parses IPv4 to its 32-bit value', () => {
		expect(parseIpAddress('1.2.3.4')).toEqual({ family: 4, value: 0x01020304n });
	});

	it('parses compressed IPv6, including the all-zero and leading-:: forms', () => {
		expect(parseIpAddress('::')).toEqual({ family: 6, value: 0n });
		expect(parseIpAddress('::1')).toEqual({ family: 6, value: 1n });
		expect(parseIpAddress('2001:db8::1')?.value).toBe(0x20010db8000000000000000000000001n);
	});

	it('reads an IPv4-mapped IPv6 literal as IPv6, the way Postgres does', () => {
		const parsed = parseIpAddress('::ffff:1.2.3.4');
		expect(parsed?.family).toBe(6);
		expect(parsed?.value).toBe(0xffff01020304n);
	});

	it('rejects junk instead of throwing', () => {
		for (const bad of ['', '1.2.3', '1.2.3.256', '2001:db8:::1', '1:2:3:4:5:6:7:8:9', '::ffff:1.2.3', 'nope']) {
			expect(parseIpAddress(bad)).toBeNull();
		}
	});
});

describe('ipInPrefix', () => {
	it('matches an IPv4 host inside and outside a /24', () => {
		expect(ipInPrefix('132.196.86.42', '132.196.86.0/24')).toBe(true);
		expect(ipInPrefix('132.196.87.42', '132.196.86.0/24')).toBe(false);
	});

	it('matches an IPv6 host inside and outside a /64', () => {
		expect(ipInPrefix('2001:4860:4801:10::5', '2001:4860:4801:10::/64')).toBe(true);
		expect(ipInPrefix('2001:4860:4801:11::5', '2001:4860:4801:10::/64')).toBe(false);
	});

	it('treats /0 as everything and a host-width prefix as exact', () => {
		expect(ipInPrefix('9.9.9.9', '0.0.0.0/0')).toBe(true);
		expect(ipInPrefix('9.9.9.9', '9.9.9.9/32')).toBe(true);
		expect(ipInPrefix('9.9.9.8', '9.9.9.9/32')).toBe(false);
	});

	it('never matches across families — an unwrapped IPv4-mapped address is the caller’s job', () => {
		expect(ipInPrefix('::ffff:132.196.86.42', '132.196.86.0/24')).toBe(false);
		expect(ipInPrefix('132.196.86.42', '::ffff:132.196.86.0/120')).toBe(false);
	});

	it('returns false for a malformed prefix or an out-of-range mask', () => {
		expect(ipInPrefix('1.2.3.4', '1.2.3.0')).toBe(false);
		expect(ipInPrefix('1.2.3.4', '1.2.3.0/33')).toBe(false);
		expect(ipInPrefix('1.2.3.4', '/24')).toBe(false);
		expect(ipInPrefix('1.2.3.4', 'x/24')).toBe(false);
	});
});
