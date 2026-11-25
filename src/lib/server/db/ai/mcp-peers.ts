/**
 * MCP peer persistence — the operator's peer config (`ai.mcp_peer`) and tool review
 * (`ai.mcp_peer_tool`). Written only by the admin door; read by the turn (which tools to mount)
 * and by the approve door (the policy an approval is revalidated against).
 */
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { McpPeerAudience } from '#lib/types/db-enums.ts';
import { db } from '../index';
import { type McpPeerPrivateDestination, type McpPeerToolHints, mcpPeer, mcpPeerTool } from '../schema/ai/mcp-peer';

export type McpPeerRow = typeof mcpPeer.$inferSelect;
export type McpPeerToolRow = typeof mcpPeerTool.$inferSelect;
export interface McpPeerRecord extends McpPeerRow {
	tools: McpPeerToolRow[];
}

async function withTools(rows: McpPeerRow[]): Promise<McpPeerRecord[]> {
	if (rows.length === 0) return [];
	const tools = await db.select().from(mcpPeerTool).orderBy(asc(mcpPeerTool.peerId), asc(mcpPeerTool.remoteName));
	return rows.map((row) => ({ ...row, tools: tools.filter((tool) => tool.peerId === row.id) }));
}

/** Every configured peer, revoked ones included — the admin list. */
export async function listMcpPeers(): Promise<McpPeerRecord[]> {
	return withTools(await db.select().from(mcpPeer).orderBy(asc(mcpPeer.id)));
}

/** The peers that may serve a turn: not revoked. Activation and audience are the caller's filter. */
export async function listLiveMcpPeers(): Promise<McpPeerRecord[]> {
	return withTools(await db.select().from(mcpPeer).where(isNull(mcpPeer.revokedAt)).orderBy(asc(mcpPeer.id)));
}

export async function getMcpPeer(id: string): Promise<McpPeerRecord | null> {
	const [row] = await db.select().from(mcpPeer).where(eq(mcpPeer.id, id)).limit(1);
	if (!row) return null;
	const tools = await db
		.select()
		.from(mcpPeerTool)
		.where(eq(mcpPeerTool.peerId, id))
		.orderBy(asc(mcpPeerTool.remoteName));
	return { ...row, tools };
}

export interface McpPeerConfigInput {
	id: string;
	label: string;
	url: string;
	secretRef: string | null;
	audience: McpPeerAudience;
	maxArgumentBytes: number | null;
	privateDestinations: McpPeerPrivateDestination[];
}

/** Create or change a peer's connection config. Changing it invalidates every pending approval for it (policy digest). */
export async function saveMcpPeer(input: McpPeerConfigInput, adminId: string) {
	const values = { ...input, updatedBy: adminId, updatedAt: new Date() };
	const [row] = await db
		.insert(mcpPeer)
		.values(values)
		.onConflictDoUpdate({ target: mcpPeer.id, set: values })
		.returning();
	return row;
}

/** Switch a peer off (or back on). A revoked peer is never listed, proposed or executed. */
export async function setMcpPeerRevoked(id: string, revoked: boolean, adminId: string) {
	const [row] = await db
		.update(mcpPeer)
		.set({ revokedAt: revoked ? new Date() : null, updatedBy: adminId, updatedAt: new Date() })
		.where(eq(mcpPeer.id, id))
		.returning();
	return row ?? null;
}

export async function recordMcpPeerTest(id: string, outcome: string) {
	await db.update(mcpPeer).set({ lastTestOutcome: outcome, lastTestedAt: new Date() }).where(eq(mcpPeer.id, id));
}

export interface DiscoveredPeerTool {
	remoteName: string;
	fingerprint: string;
	description: string;
	inputSchema: Record<string, unknown>;
	hints: McpPeerToolHints;
}

/**
 * Record what the peer lists now. The operator's pin (`activated_fingerprint`) is never touched
 * here: a tool whose fingerprint moved stays pinned to the reviewed one, so it is drift until
 * reviewed again.
 */
export async function recordDiscoveredPeerTools(peerId: string, tools: readonly DiscoveredPeerTool[]) {
	for (const tool of tools) {
		const discovered = {
			discoveredFingerprint: tool.fingerprint,
			description: tool.description,
			inputSchema: tool.inputSchema,
			hints: tool.hints,
			discoveredAt: new Date(),
		};
		await db
			.insert(mcpPeerTool)
			.values({ peerId, remoteName: tool.remoteName, ...discovered })
			.onConflictDoUpdate({ target: [mcpPeerTool.peerId, mcpPeerTool.remoteName], set: discovered });
	}
}

export interface PeerToolActivationInput {
	peerId: string;
	remoteName: string;
	/** The fingerprint the operator reviewed — must be the one last discovered. */
	fingerprint: string;
	mutates: boolean;
	reversibility: 'reversible' | 'compensatable' | 'irreversible' | 'unknown';
	argumentFields: string[] | null;
}

/**
 * Activate one tool at the fingerprint the operator reviewed. Conditional on that fingerprint
 * being the one last discovered: an operator cannot pin a contract the peer no longer lists.
 */
export async function activatePeerTool(input: PeerToolActivationInput, adminId: string) {
	const [row] = await db
		.update(mcpPeerTool)
		.set({
			activatedFingerprint: input.fingerprint,
			mutates: input.mutates,
			reversibility: input.reversibility,
			argumentFields: input.argumentFields,
			reviewedBy: adminId,
			reviewedAt: new Date(),
		})
		.where(
			and(
				eq(mcpPeerTool.peerId, input.peerId),
				eq(mcpPeerTool.remoteName, input.remoteName),
				eq(mcpPeerTool.discoveredFingerprint, input.fingerprint),
			),
		)
		.returning();
	return row ?? null;
}

/** Withdraw one tool's activation; pending approvals for it are refused at execution (`tool_revoked`). */
export async function deactivatePeerTool(peerId: string, remoteName: string, adminId: string) {
	const [row] = await db
		.update(mcpPeerTool)
		.set({ activatedFingerprint: null, reviewedBy: adminId, reviewedAt: sql`now()` })
		.where(and(eq(mcpPeerTool.peerId, peerId), eq(mcpPeerTool.remoteName, remoteName)))
		.returning();
	return row ?? null;
}
