import { describe, expect, it } from 'vitest';
import {
	isAllowedPrivateDestination,
	type PrivateDestination,
	privateDestinationProblems,
	resolvePinnedAddress,
} from './egress-address';

const answers =
	(...addresses: string[]) =>
	async () =>
		addresses;

describe('privateDestinationProblems', () => {
	it('accepts one host and a narrow range on one port', () => {
		expect(privateDestinationProblems({ cidr: '10.0.0.7/32', port: 8443 })).toEqual([]);
		expect(privateDestinationProblems({ cidr: '10.0.0.7', port: 8443 })).toEqual([]);
		expect(privateDestinationProblems({ cidr: '192.168.4.0/24', port: 443 })).toEqual([]);
		expect(privateDestinationProblems({ cidr: 'fd00::7/128', port: 443 })).toEqual([]);
	});

	it.each<[PrivateDestination, string]>([
		[{ cidr: '10.0.0.0/8', port: 443 }, 'too_broad'],
		[{ cidr: '0.0.0.0/0', port: 443 }, 'too_broad'],
		[{ cidr: 'fd00::/8', port: 443 }, 'too_broad'],
		[{ cidr: '169.254.169.254/32', port: 80 }, 'link_local'],
		[{ cidr: 'fe80::1/128', port: 80 }, 'link_local'],
		[{ cidr: '10.0.0.7/33', port: 443 }, 'invalid_cidr'],
		[{ cidr: 'sidecar.internal', port: 443 }, 'invalid_cidr'],
		[{ cidr: '10.0.0.7/32', port: 0 }, 'invalid_port'],
		[{ cidr: '10.0.0.7/32', port: 70_000 }, 'invalid_port'],
	])('refuses %j (%s)', (destination, problem) => {
		expect(privateDestinationProblems(destination)).toContain(problem);
	});
});

describe('isAllowedPrivateDestination', () => {
	const list: PrivateDestination[] = [
		{ cidr: '10.0.0.7/32', port: 8443 },
		{ cidr: '127.0.0.1/32', port: 9000 },
	];

	it('allows only the exact address and port, default none', () => {
		expect(isAllowedPrivateDestination('10.0.0.7', 8443, list)).toBe(true);
		expect(isAllowedPrivateDestination('::ffff:10.0.0.7', 8443, list)).toBe(true);
		expect(isAllowedPrivateDestination('10.0.0.7', 443, list)).toBe(false);
		expect(isAllowedPrivateDestination('10.0.0.8', 8443, list)).toBe(false);
		expect(isAllowedPrivateDestination('127.0.0.1', 9001, list)).toBe(false);
		expect(isAllowedPrivateDestination('10.0.0.7', 8443)).toBe(false);
	});

	it('never allows link-local, even when listed', () => {
		const metadata = [{ cidr: '169.254.169.254/32', port: 80 }];
		expect(isAllowedPrivateDestination('169.254.169.254', 80, metadata)).toBe(false);
	});

	it('ignores an entry that is itself invalid', () => {
		expect(isAllowedPrivateDestination('10.1.2.3', 443, [{ cidr: '10.0.0.0/8', port: 443 }])).toBe(false);
	});
});

describe('resolvePinnedAddress', () => {
	it('pins the first answer when every answer is public', async () => {
		expect(
			await resolvePinnedAddress('peer.example', 443, { resolveHost: answers('93.184.216.34', '8.8.8.8') }),
		).toEqual({ ok: true, address: '93.184.216.34', addresses: ['93.184.216.34', '8.8.8.8'] });
	});

	it('refuses the host when any answer is private — the resolver does not get to choose', async () => {
		const result = await resolvePinnedAddress('peer.example', 443, {
			resolveHost: answers('93.184.216.34', '10.0.0.1'),
		});
		expect(result).toMatchObject({ ok: false, reason: 'non_public', address: '10.0.0.1' });
	});

	it('accepts a private answer only when listed for that port', async () => {
		const privateDestinations = [{ cidr: '10.0.0.7/32', port: 8443 }];
		const resolveHost = answers('10.0.0.7');
		expect(await resolvePinnedAddress('sidecar.internal', 8443, { resolveHost, privateDestinations })).toMatchObject({
			ok: true,
			address: '10.0.0.7',
		});
		expect(await resolvePinnedAddress('sidecar.internal', 443, { resolveHost, privateDestinations })).toMatchObject({
			ok: false,
			reason: 'non_public',
		});
	});

	it('resolves an IP literal to itself, and reports an empty or failing lookup', async () => {
		expect(await resolvePinnedAddress('[::1]', 443)).toMatchObject({ ok: false, reason: 'non_public' });
		expect(await resolvePinnedAddress('none.example', 443, { resolveHost: answers() })).toMatchObject({
			ok: false,
			reason: 'unresolvable',
		});
		expect(
			await resolvePinnedAddress('none.example', 443, {
				resolveHost: async () => {
					throw new Error('ENOTFOUND');
				},
			}),
		).toMatchObject({ ok: false, reason: 'unresolvable' });
	});
});
