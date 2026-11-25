/**
 * Global tool identity: every collision class a catalogue of peers can produce, and the
 * deterministic answer to each (a distinct name by construction, or a refusal on every side).
 */
import { describe, expect, it } from 'vitest';
import { TOOL_MANIFEST } from '#lib/types/ai-tools.ts';
import { MAX_TOOL_NAME_CHARS } from './config';
import type { McpPeer } from './peer';
import { type PeerTool, type PeerToolListing, toolFingerprint } from './peer-tools';
import {
	type PeerCatalogueEntry,
	peerToolName,
	projectPeerCatalogue,
	projectPeerTools,
	RESERVED_TOOL_NAMES,
} from './projection';

function peerTool(name: string): PeerTool {
	const definition = { name, description: 'd', inputSchema: { type: 'object' as const } };
	return {
		name,
		description: 'd',
		inputSchema: { type: 'object' },
		hints: {},
		fingerprint: toolFingerprint(definition),
		flags: [],
		definition,
	};
}

const peerOf = (id: string, tools: string[]): McpPeer => ({
	id,
	url: `https://${id}.example/mcp`,
	transport: 'streamable-http',
	auth: { kind: 'none' },
	policy: { allowTools: tools, readOnlyTools: [] },
});

const listingOf = (peerId: string, tools: string[]): PeerToolListing => ({
	peerId,
	flags: [],
	tools: tools.map(peerTool),
});

const entry = (id: string, tools: string[]): PeerCatalogueEntry => ({
	peer: peerOf(id, tools),
	listing: listingOf(id, tools),
});

const names = (tools: { descriptor: { name: string } }[]) => tools.map((t) => t.descriptor.name);

describe('peerToolName', () => {
	it('keeps a provider-safe name that fits, and hashes anything else', () => {
		expect(peerToolName('acme', 'search')).toBe('mcp_acme_search');
		expect(peerToolName('acme', 'a.b')).toMatch(/^mcp_acme_a_b_[0-9a-f]{8}$/);
		expect(peerToolName('acme', 'a-b')).toMatch(/^mcp_acme_a_b_[0-9a-f]{8}$/);
		expect(peerToolName('acme', 'a.b')).not.toBe(peerToolName('acme', 'a-b'));
	});

	it('is a pure function: a sibling tool never renames another', () => {
		const alone = projectPeerTools(peerOf('acme', ['a.b']), listingOf('acme', ['a.b']));
		const crowded = projectPeerTools(peerOf('acme', ['a.b', 'a-b', 'a_b']), listingOf('acme', ['a.b', 'a-b', 'a_b']));
		expect(names(alone.tools)).toEqual([peerToolName('acme', 'a.b')]);
		expect(names(crowded.tools)).toContain(peerToolName('acme', 'a.b'));
		expect(names(crowded.tools)).toContain('mcp_acme_a_b');
		expect(new Set(names(crowded.tools)).size).toBe(3);
	});

	it('truncates long names to the provider ceiling, distinctly', () => {
		const a = `${'x'.repeat(100)}_a`;
		const b = `${'x'.repeat(100)}_b`;
		const [na, nb] = [peerToolName('acme', a), peerToolName('acme', b)];
		expect(na.length).toBeLessThanOrEqual(MAX_TOOL_NAME_CHARS);
		expect(nb.length).toBeLessThanOrEqual(MAX_TOOL_NAME_CHARS);
		expect(na).not.toBe(nb);
	});
});

describe('collisions within one peer are refused on every side', () => {
	it('a remote name chosen to equal another tool’s hashed name', () => {
		const forged = peerToolName('acme', 'a.b').slice('mcp_acme_'.length);
		const tools = ['a.b', forged, 'ok'];
		const projection = projectPeerTools(peerOf('acme', tools), listingOf('acme', tools));
		expect(names(projection.tools)).toEqual(['mcp_acme_ok']);
		expect(projection.withheld).toEqual([
			{ remoteName: 'a.b', reason: 'name_collision' },
			{ remoteName: forged, reason: 'name_collision' },
		]);
	});

	it('names that differ only in case', () => {
		const tools = ['Search', 'search'];
		const projection = projectPeerTools(peerOf('acme', tools), listingOf('acme', tools));
		expect(projection.tools).toEqual([]);
		expect(projection.withheld.map((w) => w.reason)).toEqual(['name_collision', 'name_collision']);
	});

	it('a long plain name equal to another’s truncated form', () => {
		const long = `${'y'.repeat(80)}.z`;
		const forged = peerToolName('acme', long).slice('mcp_acme_'.length);
		expect(forged.length).toBeLessThan(64);
		const tools = [long, forged];
		const projection = projectPeerTools(peerOf('acme', tools), listingOf('acme', tools));
		expect(projection.tools).toEqual([]);
	});

	it('only projected tools can collide: a forged name beside a tool the operator did not allow is fine', () => {
		const forged = peerToolName('acme', 'a.b').slice('mcp_acme_'.length);
		const projection = projectPeerTools(peerOf('acme', [forged]), listingOf('acme', ['a.b', forged]));
		expect(names(projection.tools)).toEqual([`mcp_acme_${forged}`]);
	});
});

describe('reserved catalogue names', () => {
	it('covers every manifest tool', () => {
		for (const d of TOOL_MANIFEST) expect(RESERVED_TOOL_NAMES.has(d.name.toLowerCase())).toBe(true);
	});

	it('a projected name equal to a reserved name is withheld', () => {
		const projection = projectPeerTools(peerOf('acme', ['search']), listingOf('acme', ['search']), undefined, {
			reservedNames: new Set(['mcp_acme_search']),
		});
		expect(projection.withheld).toEqual([{ remoteName: 'search', reason: 'name_reserved' }]);
	});

	it('a peer tool named like a catalogue tool stays inside its namespace', () => {
		const projection = projectPeerTools(peerOf('acme', ['desk_read_file']), listingOf('acme', ['desk_read_file']));
		expect(names(projection.tools)).toEqual(['mcp_acme_desk_read_file']);
	});
});

describe('projectPeerCatalogue', () => {
	it('two peers with the same tool get two names', () => {
		const catalogue = projectPeerCatalogue([entry('acme', ['search']), entry('docs', ['search'])]);
		expect(names(catalogue.tools)).toEqual(['mcp_acme_search', 'mcp_docs_search']);
		expect(catalogue.withheld).toEqual([]);
	});

	it('peer ids cannot overlap through the separator', () => {
		// `acme` + `docs_search` vs `acmedocs` + `search`: the id alphabet has no `_`.
		const catalogue = projectPeerCatalogue([entry('acme', ['docs_search']), entry('acmedocs', ['search'])]);
		expect(names(catalogue.tools)).toEqual(['mcp_acme_docs_search', 'mcp_acmedocs_search']);
		// The id that WOULD overlap is not an id.
		const refused = projectPeerCatalogue([entry('acme', ['docs_search']), entry('acme-docs', ['search'])]);
		expect(refused.refusedPeers).toEqual([{ peerId: 'acme-docs', reason: 'invalid_id' }]);
		expect(names(refused.tools)).toEqual(['mcp_acme_docs_search']);
	});

	it('two peers with one id are both refused', () => {
		const catalogue = projectPeerCatalogue([entry('acme', ['a']), entry('acme', ['b']), entry('docs', ['c'])]);
		expect(catalogue.refusedPeers).toEqual([
			{ peerId: 'acme', reason: 'duplicate_peer_id' },
			{ peerId: 'acme', reason: 'duplicate_peer_id' },
		]);
		expect(names(catalogue.tools)).toEqual(['mcp_docs_c']);
	});

	it('a listing that belongs to another peer is refused', () => {
		const catalogue = projectPeerCatalogue([{ peer: peerOf('acme', ['a']), listing: listingOf('docs', ['a']) }]);
		expect(catalogue.refusedPeers).toEqual([{ peerId: 'acme', reason: 'listing_mismatch' }]);
	});

	it('a cross-peer collision (here forced through the reserved set) is withheld on every side, in any order', () => {
		const entries = [entry('acme', ['x', 'search']), entry('docs', ['search', 'Y.z'])];
		const reservedNames = new Set(['mcp_docs_search']);
		const forward = projectPeerCatalogue(entries, { reservedNames });
		const backward = projectPeerCatalogue([...entries].reverse(), { reservedNames });
		expect(forward).toEqual(backward);
		expect(forward.withheld).toEqual([{ peerId: 'docs', remoteName: 'search', reason: 'name_reserved' }]);
	});

	it('every name across many peers and awkward remote names is unique, mcp_-prefixed and provider-safe', () => {
		const remote = [
			'search',
			'Search2',
			'a.b',
			'a-b',
			'a_b',
			'x'.repeat(128),
			`${'y'.repeat(70)}.a`,
			`${'y'.repeat(70)}-a`,
		];
		const catalogue = projectPeerCatalogue(['acme', 'acmedocs', 'docs', 'docs2', 'a'].map((id) => entry(id, remote)));
		const all = names(catalogue.tools);
		expect(all).toHaveLength(5 * remote.length);
		expect(new Set(all.map((n) => n.toLowerCase())).size).toBe(all.length);
		for (const name of all) {
			expect(name).toMatch(/^mcp_[a-z0-9]+_[A-Za-z0-9_]+$/);
			expect(name.length).toBeLessThanOrEqual(MAX_TOOL_NAME_CHARS);
		}
	});
});
