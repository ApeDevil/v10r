import { describe, expect, it, vi } from 'vitest';
import { loadDelegationPeers, parseDelegationPeers } from './delegation-directory.ts';

const PEER = {
	id: 'reviewer',
	label: 'Independent reviewer',
	origin: 'https://reviews.example',
	skills: ['architecture-review'],
	auth: { kind: 'none' },
};

describe('the operator delegation directory', () => {
	it('is empty when unset or malformed', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(parseDelegationPeers(undefined)).toEqual([]);
		expect(parseDelegationPeers('not json')).toEqual([]);
		expect(parseDelegationPeers('{"id":"x"}')).toEqual([]);
		warn.mockRestore();
	});

	it('keeps valid entries and drops invalid ones without echoing values', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const raw = JSON.stringify([
			PEER,
			{ ...PEER, id: 'Bad Id' },
			{ ...PEER, id: 'leaky', auth: { kind: 'bearer', secretRef: 'sk-live-not-a-ref' } },
			{ ...PEER, id: 'pathy', origin: 'https://reviews.example/path' },
			{ id: 'shape' },
		]);
		expect(parseDelegationPeers(raw).map((peer) => peer.id)).toEqual(['reviewer']);
		const logged = warn.mock.calls.flat().join(' ');
		expect(logged).not.toContain('sk-live-not-a-ref');
		expect(logged).toContain('invalid_secret_ref');
		warn.mockRestore();
	});

	it('reads A2A_DELEGATION_PEERS', () => {
		expect(loadDelegationPeers({ A2A_DELEGATION_PEERS: JSON.stringify([PEER]) })).toHaveLength(1);
		expect(loadDelegationPeers({})).toEqual([]);
	});
});
