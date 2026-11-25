/**
 * MCP PEER — an operator-configured external MCP server v10r calls as a client, and the
 * operator's review of each tool it lists.
 *
 * Only an administrator writes these rows (`/admin/ai/peers`); a user never names an endpoint.
 * The peer's credential is a REFERENCE (`MCP_PEER_SECRET_*`), never a value: the secret stays
 * in the deployment's environment. A tool runs nowhere until the operator activated it, and the
 * activation pins the tool fingerprint they reviewed — a peer that changes the tool afterwards
 * (tool drift) is withheld from the catalogue and refused at execution until reviewed again.
 *
 * `revoked_at` switches the whole peer off: nothing is listed, proposed or executed for it.
 */
import { sql } from 'drizzle-orm';
import { boolean, check, integer, jsonb, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { aiSchema } from './conversation';

export const mcpPeerAudienceEnum = aiSchema.enum('mcp_peer_audience', ['admin', 'user']);

export const externalReversibilityEnum = aiSchema.enum('external_reversibility', [
	'reversible',
	'compensatable',
	'irreversible',
	'unknown',
]);

/** One narrow private address + port the peer may resolve to (`PrivateDestination`). */
export type McpPeerPrivateDestination = { cidr: string; port: number };

export const mcpPeer = aiSchema.table(
	'mcp_peer',
	{
		/** Slug `[a-z][a-z0-9]{0,23}` — the tool-name namespace `mcp_<id>_<tool>`. */
		id: text('id').primaryKey(),
		label: text('label').notNull(),
		/** Streamable HTTP endpoint; checked by the endpoint guard on every connect. */
		url: text('url').notNull(),
		/** Name of the bearer secret in the deployment environment; null for an unauthenticated peer. */
		secretRef: text('secret_ref'),
		/** Who may call the peer's activated tools; revalidated when an approval executes. */
		audience: mcpPeerAudienceEnum('audience').notNull().default('admin'),
		/** Bound on one call's canonical arguments; null = the client default. */
		maxArgumentBytes: integer('max_argument_bytes'),
		privateDestinations: jsonb('private_destinations').notNull().default([]).$type<McpPeerPrivateDestination[]>(),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
		/** Last connection test: `ok`, or the machine reason it failed. */
		lastTestOutcome: text('last_test_outcome'),
		lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
		updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		check('mcp_peer_id_shape', sql`${table.id} ~ '^[a-z][a-z0-9]{0,23}$'`),
		check(
			'mcp_peer_secret_ref_shape',
			sql`${table.secretRef} IS NULL OR ${table.secretRef} ~ '^MCP_PEER_SECRET_[A-Z0-9][A-Z0-9_]{0,46}$'`,
		),
		check('mcp_peer_label_len', sql`char_length(${table.label}) BETWEEN 1 AND 80`),
	],
);

/** What the peer said about a tool when it was last discovered — shown on review, never obeyed. */
export type McpPeerToolHints = {
	title?: string;
	readOnlyHint?: boolean;
	destructiveHint?: boolean;
	idempotentHint?: boolean;
	openWorldHint?: boolean;
};

export const mcpPeerTool = aiSchema.table(
	'mcp_peer_tool',
	{
		peerId: text('peer_id')
			.notNull()
			.references(() => mcpPeer.id, { onDelete: 'cascade' }),
		/** The peer's own tool name. */
		remoteName: text('remote_name').notNull(),
		/** Fingerprint of the tool as last discovered. */
		discoveredFingerprint: text('discovered_fingerprint').notNull(),
		/** The peer's description as last discovered (bounded; untrusted text for the operator's review). */
		description: text('description').notNull().default(''),
		inputSchema: jsonb('input_schema').notNull().$type<Record<string, unknown>>(),
		hints: jsonb('hints').notNull().default({}).$type<McpPeerToolHints>(),
		/**
		 * The fingerprint the operator reviewed and activated — the pin. Null: not activated, the
		 * tool is never mounted. A discovered fingerprint that differs from it is tool drift.
		 */
		activatedFingerprint: text('activated_fingerprint'),
		/** The operator's word on whether a call may change persistent data on the peer. */
		mutates: boolean('mutates').notNull().default(true),
		reversibility: externalReversibilityEnum('reversibility').notNull().default('unknown'),
		/** Top-level argument fields a call may send; null = whatever the input schema accepts. */
		argumentFields: jsonb('argument_fields').$type<string[]>(),
		reviewedBy: text('reviewed_by').references(() => user.id, { onDelete: 'set null' }),
		reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
		discoveredAt: timestamp('discovered_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.peerId, table.remoteName] })],
);
