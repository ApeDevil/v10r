/**
 * AGENT EXTERNAL OPERATION — the approval binding, disclosure, execution claim and receipt of
 * one assistant action that leaves the deployment (an MCP peer tool call; an A2A delegation).
 *
 * It is the sibling of `agent_proposal_step`, not a second approval system: the user approves
 * the `agent_proposal` it belongs to (same card, same approve door, same expiry and ownership),
 * and this row is what that approval binds and what the run left behind. One proposal carries
 * at most one external operation (the primary key).
 *
 * The status is the execution claim. `pending → claimed` is a conditional UPDATE in the same
 * transaction as the proposal's `approved → executing`, so exactly one executor — on any
 * instance — owns the approval. `claimed → dispatched` is written BEFORE the request may leave,
 * so after a crash the row says which side of the wire it died on: `claimed` heals to
 * `failed`/`not_sent`, `dispatched` heals to `unknown`/`possibly_sent`. Nothing ever moves a
 * row back to `pending`: an approval whose outcome is unknown is never re-executed, and no
 * remote operation is claimed to have happened exactly once — only to have been SENT at most once.
 */
import { sql } from 'drizzle-orm';
import { index, jsonb, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { aiSchema } from './conversation';
import { agentProposal } from './proposal';

export const externalProtocolEnum = aiSchema.enum('agent_external_protocol', ['mcp', 'a2a']);

export const externalOperationStatusEnum = aiSchema.enum('agent_external_operation_status', [
	'pending',
	'claimed',
	'dispatched',
	'succeeded',
	'failed',
	'unknown',
	'refused',
]);

export const externalDeliveryEnum = aiSchema.enum('agent_external_delivery', ['not_sent', 'sent', 'possibly_sent']);

/** The peer's answer as the model may read it: one escaped `<untrusted-content>` element. */
export type ExternalOperationResultRecord = {
	text: string;
	flags: string[];
	/** The remote task an A2A peer opened for the call — the correlation id across both traces. */
	remoteTask?: { taskId: string | null; contextId: string | null };
};

export const agentExternalOperation = aiSchema.table(
	'agent_external_operation',
	{
		proposalId: text('proposal_id')
			.primaryKey()
			.references(() => agentProposal.id, { onDelete: 'cascade' }),
		/** The user who proposed it; only they may execute it. */
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		protocol: externalProtocolEnum('protocol').notNull(),
		peerId: text('peer_id').notNull(),
		/** The remote operation: MCP tool name, or A2A skill id. */
		operation: text('operation').notNull(),
		/** The model-facing tool name the call was proposed under. */
		toolName: text('tool_name').notNull(),
		endpoint: text('endpoint').notNull(),
		contractDigest: text('contract_digest').notNull(),
		policyDigest: text('policy_digest').notNull(),
		argumentsDigest: text('arguments_digest').notNull(),
		/** The exact arguments the user approved (canonical JSON, parsed back). */
		arguments: jsonb('arguments').notNull().$type<Record<string, unknown>>(),
		/** The `ExternalDisclosure` the card showed. */
		disclosure: jsonb('disclosure').notNull().$type<Record<string, unknown>>(),
		status: externalOperationStatusEnum('status').notNull().default('pending'),
		delivery: externalDeliveryEnum('delivery'),
		/** Machine reason for a non-`succeeded` outcome. */
		reason: text('reason'),
		result: jsonb('result').$type<ExternalOperationResultRecord>(),
		/** Which execution owns the claim; a healed or stale executor cannot settle someone else's. */
		claimToken: text('claim_token'),
		claimedAt: timestamp('claimed_at', { withTimezone: true }),
		dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
		settledAt: timestamp('settled_at', { withTimezone: true }),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		// The recovery read: claims that never settled.
		index('agent_external_operation_unsettled_idx')
			.on(table.claimedAt)
			.where(sql`${table.status} IN ('claimed', 'dispatched')`),
		index('agent_external_operation_user_idx').on(table.userId),
	],
);
