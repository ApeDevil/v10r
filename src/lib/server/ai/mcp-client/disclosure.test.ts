import { describe, expect, it } from 'vitest';
import { DEFAULT_PEER_ARGUMENT_BYTES } from './config';
import { preparePeerArguments } from './disclosure';
import type { McpPeer } from './peer';

const SECRET = 'peer-bearer-s3cr3t-value';

const peer = (over: Partial<McpPeer> = {}): McpPeer => ({
	id: 'docs',
	url: 'https://mcp.example.com/mcp',
	transport: 'streamable-http',
	auth: { kind: 'bearer', secretRef: 'MCP_PEER_SECRET_DOCS' },
	policy: { allowTools: ['search'], readOnlyTools: ['search'] },
	...over,
});

const search = {
	name: 'search',
	inputSchema: {
		type: 'object',
		properties: { query: { type: 'string' }, limit: { type: 'number' } },
		required: ['query'],
		additionalProperties: false,
	},
};

const resolve = () => SECRET;

describe('preparePeerArguments', () => {
	it('canonicalizes the arguments and describes exactly what is disclosed', () => {
		const prepared = preparePeerArguments(peer(), search, { limit: 3, query: 'wall' }, resolve);
		expect(prepared).toEqual({
			ok: true,
			arguments: { limit: 3, query: 'wall' },
			canonical: '{"limit":3,"query":"wall"}',
			disclosure: {
				peerId: 'docs',
				remoteName: 'search',
				destination: 'https://mcp.example.com',
				sends: 'tool_arguments_only',
				argumentFields: ['limit', 'query'],
				argumentBytes: 26,
				credential: { kind: 'deployment_bearer', secretRef: 'MCP_PEER_SECRET_DOCS' },
			},
		});
		// The disclosure names the credential's reference, never its value.
		expect(JSON.stringify(prepared)).not.toContain(SECRET);
	});

	it('refuses arguments the tool schema does not accept', () => {
		expect(preparePeerArguments(peer(), search, { limit: 3 }, resolve)).toEqual({
			ok: false,
			reason: 'arguments_invalid',
		});
		expect(preparePeerArguments(peer(), search, { query: 'x', conversation: 'history…' }, resolve)).toEqual({
			ok: false,
			reason: 'arguments_invalid',
		});
	});

	it('refuses anything that is not a plain JSON object', () => {
		expect(preparePeerArguments(peer(), search, ['query'], resolve)).toMatchObject({ reason: 'arguments_not_object' });
		expect(preparePeerArguments(peer(), search, null, resolve)).toMatchObject({ reason: 'arguments_not_object' });
		expect(preparePeerArguments(peer(), search, { query: 1n }, resolve)).toMatchObject({
			reason: 'arguments_not_json',
		});
	});

	it('bounds the size — default and per peer', () => {
		const big = { query: 'q'.repeat(DEFAULT_PEER_ARGUMENT_BYTES) };
		expect(preparePeerArguments(peer(), search, big, resolve)).toMatchObject({ reason: 'arguments_too_large' });
		const tight = peer({ disclosure: { maxArgumentBytes: 16 } });
		expect(preparePeerArguments(tight, search, { query: 'a much longer query' }, resolve)).toMatchObject({
			reason: 'arguments_too_large',
		});
		expect(preparePeerArguments(tight, search, { query: 'ok' }, resolve)).toMatchObject({ ok: true });
	});

	it('enforces the operator’s field allowlist — refusing, never stripping', () => {
		const p = peer({
			policy: { allowTools: ['search'], readOnlyTools: [], toolRules: { search: { argumentFields: ['query'] } } },
		});
		expect(preparePeerArguments(p, search, { query: 'x' }, resolve)).toMatchObject({ ok: true });
		expect(preparePeerArguments(p, search, { query: 'x', limit: 2 }, resolve)).toMatchObject({
			reason: 'argument_field_not_allowed',
		});
		const nothing = peer({
			policy: { allowTools: ['ping'], readOnlyTools: [], toolRules: { ping: { argumentFields: [] } } },
		});
		const ping = { name: 'ping', inputSchema: { type: 'object' } };
		expect(preparePeerArguments(nothing, ping, {}, resolve)).toMatchObject({ ok: true });
		expect(preparePeerArguments(nothing, ping, { note: 'x' }, resolve)).toMatchObject({
			reason: 'argument_field_not_allowed',
		});
	});

	it('refuses arguments that carry the peer’s own secret', () => {
		expect(preparePeerArguments(peer(), search, { query: `token ${SECRET}` }, resolve)).toMatchObject({
			reason: 'credential_in_arguments',
		});
	});

	it('refuses when the schema cannot be checked', () => {
		const broken = { name: 'search', inputSchema: { type: 'object', $schema: 'https://example.com/unknown-draft' } };
		expect(preparePeerArguments(peer(), broken, { query: 'x' }, resolve)).toMatchObject({
			reason: 'schema_unverifiable',
		});
	});
});
