import { describe, expect, it } from 'vitest';
import { describeApplicationIdentity } from './application-identity';

describe('describeApplicationIdentity', () => {
	it('verifies the domain of a metadata-document client and recognizes known hosts by domain', () => {
		expect(
			describeApplicationIdentity({
				clientId: 'https://claude.ai/oauth/claude-code-client-metadata',
				name: 'Claude Code',
				uri: null,
				clientDiscoveryId: 'https://claude.ai/oauth/claude-code-client-metadata',
			}),
		).toEqual({ kind: 'verified-domain', domain: 'claude.ai', recognizedAs: 'Claude', declaredName: 'Claude Code' });
	});

	it('never recognizes a host by its declared name', () => {
		const identity = describeApplicationIdentity({
			clientId: 'random-id-from-registration',
			name: 'ChatGPT',
			uri: 'https://chatgpt.com',
			clientDiscoveryId: null,
		});
		expect(identity).toEqual({ kind: 'self-declared', declaredName: 'ChatGPT', declaredHost: 'chatgpt.com' });
	});

	it('does not recognize a lookalike subdomain or a metadata document on another domain', () => {
		const identity = describeApplicationIdentity({
			clientId: 'https://claude.ai.evil.example/client.json',
			name: 'Claude',
			uri: null,
			clientDiscoveryId: 'https://claude.ai.evil.example/client.json',
		});
		expect(identity).toMatchObject({ kind: 'verified-domain', domain: 'claude.ai.evil.example', recognizedAs: null });
	});

	it('strips control and bidi characters and bounds the length of a declared name', () => {
		const identity = describeApplicationIdentity({
			clientId: 'x',
			name: `Good‮evil\u0007${'a'.repeat(200)}`,
			uri: 'http://insecure.example',
			clientDiscoveryId: null,
		});
		expect(identity.kind).toBe('self-declared');
		if (identity.kind !== 'self-declared') return;
		expect(identity.declaredName?.startsWith('Goodevil')).toBe(true);
		expect(identity.declaredName?.length).toBe(80);
		expect(identity.declaredHost).toBeNull(); // non-HTTPS client_uri is not even a hint
	});

	it('treats an empty name as no name', () => {
		const identity = describeApplicationIdentity({ clientId: 'x', name: '​ ', uri: null, clientDiscoveryId: null });
		expect(identity).toEqual({ kind: 'self-declared', declaredName: null, declaredHost: null });
	});
});
