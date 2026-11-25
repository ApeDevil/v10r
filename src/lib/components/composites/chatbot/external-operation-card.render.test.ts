/**
 * The external-operation approval card, server-rendered: each fact the approval authorizes is
 * its own row (destination, operation, credential, effect, reversibility, one-time grant), the
 * compact preview and the complete outgoing arguments are two separate views, and the complete
 * view carries every byte, the digest the approval binds and what the protocol adds.
 */
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { ExternalOperationCard as Card } from '#lib/types/ai-proposal.ts';
import ExternalOperationCard from './ExternalOperationCard.svelte';

const long = `${'a'.repeat(300)}-THE-END`;
const card = (overrides: Partial<Card> = {}): Card => ({
	toolName: 'mcp_notes_note_write',
	protocol: 'mcp',
	peerId: 'notes',
	peerLabel: 'Notebook',
	destination: 'https://peer.example',
	operation: 'note_write',
	fields: ['key', 'value'],
	preview: `{"key":"demo","value":"${'a'.repeat(80)}… (+228 chars)"}`,
	bytes: 340,
	credential: { kind: 'operator_secret', ref: 'MCP_PEER_SECRET_NOTES' },
	mutates: true,
	reversibility: 'irreversible',
	grant: 'once',
	contentClass: 'arguments_only',
	quotedFrom: [],
	outgoing: {
		document: `{\n  "key": "demo",\n  "value": "${long}"\n}`,
		digest: 'f'.repeat(64),
		bytes: 340,
		envelope: [],
	},
	...overrides,
});

const html = (props: Partial<Card> = {}) =>
	render(ExternalOperationCard, { props: { card: card(props), decided: false } }).body;

describe('ExternalOperationCard', () => {
	it('shows the compact preview and, separately, the complete outgoing arguments', () => {
		const body = html();
		expect(body).toContain('Compact preview (long values shortened)');
		expect(body).toContain('Complete outgoing arguments (340 bytes)');
		// The preview is cut; the complete view carries the value to its last character.
		expect(body).toContain('… (+228 chars)');
		expect(body).toContain('-THE-END');
		expect(body).toContain('f'.repeat(64));
	});

	it('names destination, operation, credential, effect, reversibility and the one-time grant each on its own row', () => {
		const body = html();
		for (const label of ['Destination', 'Operation', 'Credential', 'Effect', 'Undo', 'Authorization']) {
			expect(body).toMatch(new RegExp(`<dt[^>]*>${label}</dt>`));
		}
		expect(body).toContain('https://peer.example');
		expect(body).toContain('note_write');
		expect(body).toContain('MCP_PEER_SECRET_NOTES');
		expect(body).toContain('May change data on the peer');
		expect(body).toContain('irreversible');
		expect(body).toContain('Approving runs this one call, once.');
	});

	it('lists what the protocol adds beside the arguments (A2A metadata)', () => {
		const body = html({
			protocol: 'a2a',
			mutates: false,
			outgoing: {
				document: '{\n  "model": {}\n}',
				digest: 'e'.repeat(64),
				bytes: 12,
				envelope: [
					{ field: 'metadata.skill', value: 'performance-review' },
					{ field: 'metadata.v10r.delegationDepth', value: '1' },
				],
			},
		});
		expect(body).toContain('Added by v10r beside the arguments');
		expect(body).toContain('metadata.skill');
		expect(body).toContain('performance-review');
		expect(body).toContain('metadata.v10r.delegationDepth');
	});

	it('escapes markup in the outgoing document: it is shown as text, never rendered', () => {
		const body = html({
			outgoing: { document: '{"v":"<img src=x onerror=alert(1)>"}', digest: 'd'.repeat(64), bytes: 30, envelope: [] },
		});
		expect(body).not.toContain('<img src=x');
		expect(body).toContain('&lt;img src=x');
	});

	it('still asks for the separate quoted-content authorization', () => {
		const body = html({ contentClass: 'quotes_read_content', quotedFrom: ['desk_read_file'] });
		expect(body).toContain('desk_read_file');
		expect(body).toContain('I also authorize sending that content to this peer');
	});
});
