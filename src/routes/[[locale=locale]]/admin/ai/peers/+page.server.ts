import { fail } from '@sveltejs/kit';
import * as m from '#lib/paraglide/messages.js';
import {
	discoverDirectoryPeerTools,
	type PeerConfigRejection,
	savePeerConfig,
	testDirectoryPeer,
} from '#lib/server/ai/mcp-client/index.ts';
import { activatePeerTool, deactivatePeerTool, listMcpPeers, setMcpPeerRevoked } from '#lib/server/db/ai/mcp-peers.ts';
import { requireAdmin } from '#lib/server/http/guards.ts';
import type { Actions, PageServerLoad } from './$types';

/**
 * MCP peers — where the operator connects external MCP servers the deskbot may call. Every
 * decision is the operator's: the endpoint (https, guarded on every connect), the credential
 * REFERENCE (`MCP_PEER_SECRET_*`, never a value), who may call it, which tools are active at
 * which reviewed fingerprint, and each tool's mutates / reversibility / field allowlist. Users
 * never configure an endpoint. This file only translates form data; the rules live in
 * `#lib/server/ai/mcp-client/peer-directory.ts` and `#lib/server/db/ai/mcp-peers.ts`.
 */

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	try {
		const peers = await listMcpPeers();
		return {
			title: m.admin_ai_peers_title(),
			unavailable: false as const,
			peers: peers.map((peer) => ({
				id: peer.id,
				label: peer.label,
				url: peer.url,
				secretRef: peer.secretRef,
				audience: peer.audience,
				maxArgumentBytes: peer.maxArgumentBytes,
				privateDestinations: peer.privateDestinations,
				revoked: peer.revokedAt !== null,
				lastTestOutcome: peer.lastTestOutcome,
				lastTestedAt: peer.lastTestedAt?.toISOString() ?? null,
				tools: peer.tools.map((tool) => ({
					remoteName: tool.remoteName,
					description: tool.description,
					hints: tool.hints,
					inputSchema: JSON.stringify(tool.inputSchema),
					discoveredFingerprint: tool.discoveredFingerprint,
					activatedFingerprint: tool.activatedFingerprint,
					drift: tool.activatedFingerprint !== null && tool.activatedFingerprint !== tool.discoveredFingerprint,
					mutates: tool.mutates,
					reversibility: tool.reversibility,
					argumentFields: tool.argumentFields,
				})),
			})),
		};
	} catch {
		return { title: m.admin_ai_peers_title(), unavailable: true as const, peers: [] };
	}
};

const text = (data: FormData, name: string) => {
	const value = data.get(name);
	return typeof value === 'string' ? value.trim() : '';
};

/** `cidr:port` per line → private destinations; null when a line does not parse. */
function destinationsOf(raw: string): Array<{ cidr: string; port: number }> | null {
	const lines = raw
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);
	const parsed = lines.map((line) => {
		const at = line.lastIndexOf(':');
		const port = Number(line.slice(at + 1));
		return at > 0 && Number.isInteger(port) ? { cidr: line.slice(0, at), port } : null;
	});
	return parsed.every((d) => d !== null) ? (parsed as Array<{ cidr: string; port: number }>) : null;
}

function rejectionMessage(problems: readonly (PeerConfigRejection | 'invalid_destinations')[]): string {
	return m.admin_ai_peers_error_invalid({ problems: problems.join(', ') });
}

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const { user } = requireAdmin(locals);
		const data = await request.formData();
		const destinations = destinationsOf(text(data, 'privateDestinations'));
		if (!destinations) return fail(400, { message: rejectionMessage(['invalid_destinations']) });
		const maxBytes = text(data, 'maxArgumentBytes');
		const saved = await savePeerConfig(
			{
				id: text(data, 'id'),
				label: text(data, 'label'),
				url: text(data, 'url'),
				secretRef: text(data, 'secretRef') || null,
				audience: text(data, 'audience') === 'user' ? 'user' : 'admin',
				maxArgumentBytes: maxBytes ? Number(maxBytes) : null,
				privateDestinations: destinations,
			},
			user.id,
		);
		if (!saved.ok) return fail(400, { message: rejectionMessage(saved.problems) });
		return { message: m.admin_ai_peers_saved() };
	},

	test: async ({ request, locals }) => {
		requireAdmin(locals);
		const id = text(await request.formData(), 'id');
		const result = await testDirectoryPeer(id);
		return result.outcome === 'ok'
			? { message: m.admin_ai_peers_test_ok({ count: String(result.tools) }) }
			: fail(502, { message: m.admin_ai_peers_test_failed({ outcome: result.outcome }) });
	},

	discover: async ({ request, locals }) => {
		requireAdmin(locals);
		const id = text(await request.formData(), 'id');
		const discovery = await discoverDirectoryPeerTools(id);
		if (discovery.outcome !== 'ok')
			return fail(502, { message: m.admin_ai_peers_test_failed({ outcome: discovery.outcome }) });
		const changed = discovery.drift?.changed ?? [];
		return {
			message:
				changed.length > 0
					? m.admin_ai_peers_discovered_drift({ tools: changed.join(', ') })
					: m.admin_ai_peers_discovered({ count: String(discovery.listing?.tools.length ?? 0) }),
		};
	},

	activate: async ({ request, locals }) => {
		const { user } = requireAdmin(locals);
		const data = await request.formData();
		const fields = text(data, 'argumentFields');
		const reversibility = text(data, 'reversibility');
		const row = await activatePeerTool(
			{
				peerId: text(data, 'peerId'),
				remoteName: text(data, 'remoteName'),
				fingerprint: text(data, 'fingerprint'),
				mutates: text(data, 'mutates') !== 'false',
				reversibility:
					reversibility === 'reversible' || reversibility === 'compensatable' || reversibility === 'irreversible'
						? reversibility
						: 'unknown',
				argumentFields: fields
					? fields
							.split(',')
							.map((field) => field.trim())
							.filter(Boolean)
					: null,
			},
			user.id,
		);
		// The conditional update refuses a fingerprint the peer no longer lists: discover again.
		if (!row) return fail(409, { message: m.admin_ai_peers_activate_stale() });
		return { message: m.admin_ai_peers_activated() };
	},

	deactivate: async ({ request, locals }) => {
		const { user } = requireAdmin(locals);
		const data = await request.formData();
		await deactivatePeerTool(text(data, 'peerId'), text(data, 'remoteName'), user.id);
		return { message: m.admin_ai_peers_deactivated() };
	},

	revoke: async ({ request, locals }) => {
		const { user } = requireAdmin(locals);
		const data = await request.formData();
		await setMcpPeerRevoked(text(data, 'id'), text(data, 'revoked') !== 'false', user.id);
		return { message: m.admin_ai_peers_saved() };
	},
};
