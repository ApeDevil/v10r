import { afterEach, describe, expect, it } from 'vitest';
import {
	environmentSecretResolver,
	isPeerSecretRef,
	type McpPeer,
	peerConfigProblems,
	peerToolReversibility,
} from './peer';

const peer = (over: Partial<McpPeer> = {}): McpPeer => ({
	id: 'docs',
	url: 'https://mcp.example.com/mcp',
	transport: 'streamable-http',
	auth: { kind: 'bearer', secretRef: 'MCP_PEER_SECRET_DOCS' },
	policy: { allowTools: ['search'], readOnlyTools: ['search'] },
	...over,
});

describe('peerConfigProblems', () => {
	it('accepts a well-formed peer', () => {
		expect(peerConfigProblems(peer())).toEqual([]);
	});

	it('refuses a literal token where a secret reference belongs', () => {
		expect(peerConfigProblems(peer({ auth: { kind: 'bearer', secretRef: 'sk-live-abc.def' } }))).toEqual([
			'invalid_secret_ref',
		]);
	});

	it.each([
		'DATABASE_URL',
		'BETTER_AUTH_SECRET',
		'OPENAI_API_KEY',
		'MCP_ADMIN_TOKEN',
		'CRON_SECRET',
		'MCP_PEER_SECRET_',
		'MCP_PEER_SECRET_lower',
		'XMCP_PEER_SECRET_DOCS',
	])('refuses a secret reference outside the MCP_PEER_SECRET_ namespace: %s', (secretRef) => {
		expect(isPeerSecretRef(secretRef)).toBe(false);
		expect(peerConfigProblems(peer({ auth: { kind: 'bearer', secretRef } }))).toContain('invalid_secret_ref');
	});

	it('refuses an id that cannot be an unambiguous tool-name namespace', () => {
		expect(peerConfigProblems(peer({ id: 'Docs Server' }))).toContain('invalid_id');
		// `-` and `_` would make `mcp_<peer>_<tool>` ambiguous between peers.
		expect(peerConfigProblems(peer({ id: 'acme-docs' }))).toContain('invalid_id');
		expect(peerConfigProblems(peer({ id: 'acme_docs' }))).toContain('invalid_id');
		expect(peerConfigProblems(peer({ id: 'acmedocs2' }))).toEqual([]);
	});

	it('refuses a read-only tool the operator did not allow, and an empty allow list', () => {
		expect(peerConfigProblems(peer({ policy: { allowTools: ['search'], readOnlyTools: ['delete'] } }))).toEqual([
			'read_only_not_allowed',
		]);
		expect(peerConfigProblems(peer({ policy: { allowTools: [], readOnlyTools: [] } }))).toEqual(['empty_allow_list']);
	});

	it('refuses a tool rule for an unlisted tool, a bad disclosure bound and a broad private destination', () => {
		expect(
			peerConfigProblems(
				peer({
					policy: { allowTools: ['search'], readOnlyTools: [], toolRules: { delete: { reversibility: 'reversible' } } },
				}),
			),
		).toEqual(['rule_for_unlisted_tool']);
		expect(peerConfigProblems(peer({ disclosure: { maxArgumentBytes: 10_000_000 } }))).toEqual(['invalid_disclosure']);
		expect(peerConfigProblems(peer({ privateDestinations: [{ cidr: '10.0.0.0/8', port: 443 }] }))).toEqual([
			'invalid_private_destination',
		]);
		expect(peerConfigProblems(peer({ privateDestinations: [{ cidr: '169.254.169.254/32', port: 80 }] }))).toEqual([
			'invalid_private_destination',
		]);
	});
});

describe('environmentSecretResolver', () => {
	const saved = { ...process.env };
	afterEach(() => {
		process.env = { ...saved };
	});

	it('reads a reference inside the namespace and nothing outside it, whatever the environment holds', () => {
		process.env.MCP_PEER_SECRET_DOCS = 'peer-token';
		process.env.DATABASE_URL = 'postgres://user:db-password@host/db';
		process.env.BETTER_AUTH_SECRET = 'auth-secret';
		expect(environmentSecretResolver('MCP_PEER_SECRET_DOCS')).toBe('peer-token');
		expect(environmentSecretResolver('DATABASE_URL')).toBeUndefined();
		expect(environmentSecretResolver('BETTER_AUTH_SECRET')).toBeUndefined();
	});
});

describe('peerToolReversibility', () => {
	it('is the operator’s word, and unknown when nobody said', () => {
		const p = peer({
			policy: {
				allowTools: ['search', 'refund'],
				readOnlyTools: [],
				toolRules: { refund: { reversibility: 'compensatable' } },
			},
		});
		expect(peerToolReversibility(p, 'refund')).toBe('compensatable');
		expect(peerToolReversibility(p, 'search')).toBe('unknown');
	});
});
