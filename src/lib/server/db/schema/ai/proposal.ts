/**
 * AGENT PROPOSAL — Plan-before-execute state machine.
 *
 * A proposal is a "what the agent wants to do, pending user approval" record.
 * It has its own lifecycle — distinct from the `tool_call` record of what
 * actually ran — so queries like "what did the user approve at 3:42pm" or
 * "how many proposals were rejected last week" stay answerable.
 *
 * Exactly-once execution is enforced via the `status` state machine + a
 * partial unique index on `proposal_id` where `status IN ('executing',
 * 'executed')`. A retried approval finds the existing "executed" row and
 * returns the step receipts (`agent_proposal_step`) instead of re-running
 * the payload. The per-step record lives in its own table, written inside
 * the same transaction as the step's desk mutation — see `proposal-step.ts`.
 *
 * See `docs/blueprint/ai/harness-lens.md` for the broader context.
 */

import { sql } from 'drizzle-orm';
import { index, jsonb, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { aiSchema, conversation, message } from './conversation';

export const proposalStatusEnum = aiSchema.enum('agent_proposal_status', [
	'pending',
	'approved',
	'rejected',
	'executing',
	'executed',
	'failed',
	'expired',
]);

export const proposalRiskTierEnum = aiSchema.enum('agent_proposal_risk_tier', ['low', 'medium', 'high']);

/**
 * The reviewed baseline of a mutation step: the file the user saw on the PlanCard and
 * the version it had when the plan was proposed. Replay compares against THIS — never
 * a fresh read — so an edit made between review and approval surfaces as a conflict
 * instead of being overwritten by a plan that described an older document. Creates
 * have no baseline.
 */
export type ProposedTarget = {
	fileId: string;
	fileType: 'spreadsheet' | 'markdown';
	name: string;
	/** `spreadsheet.version` / `markdown.version` at proposal time; null for a rename/delete. */
	version: number | null;
	/** `file.updatedAt` at proposal time — the rename/delete baseline. ISO string (jsonb). */
	updatedAt: string;
};

/** A single proposed tool call inside a proposal's payload. */
export type ProposedToolCall = {
	toolName: string;
	args: Record<string, unknown>;
	/** What the step does, as the PlanCard and the receipt say it: `Rename "Q2" → "Q3"`. */
	action: string;
	/** Optional model-supplied rationale for this specific step. */
	rationale?: string;
	/** Reviewed baseline; absent for creates. */
	target?: ProposedTarget;
};

export const agentProposal = aiSchema.table(
	'agent_proposal',
	{
		/** Prefixed `prp_`. */
		id: text('id').primaryKey(),
		conversationId: text('conversation_id')
			.notNull()
			.references(() => conversation.id, { onDelete: 'cascade' }),
		/** The assistant message that generated this proposal. */
		messageId: text('message_id')
			.notNull()
			.references(() => message.id, { onDelete: 'cascade' }),
		status: proposalStatusEnum('status').notNull().default('pending'),
		riskTier: proposalRiskTierEnum('risk_tier').notNull().default('medium'),
		/** Proposed tool calls, in execution order. */
		payload: jsonb('payload').notNull().$type<ProposedToolCall[]>(),
		/**
		 * Scopes granted at the moment the plan was proposed.
		 *
		 * Approval happens in a separate request, so replaying with whatever the
		 * client sends at approve time would let the grant be widened after the
		 * user reviewed the plan. Freezing it here binds the approval to the
		 * permissions the plan was actually shown under.
		 */
		grantedScopes: jsonb('granted_scopes').notNull().default([]).$type<string[]>(),
		/** Model's explanation of the plan — shown in the PlanCard UI. */
		rationale: text('rationale').notNull().default(''),
		/** Who approved the proposal, if approved. */
		approvedBy: text('approved_by').references(() => user.id, { onDelete: 'set null' }),
		approvedAt: timestamp('approved_at', { withTimezone: true }),
		rejectedReason: text('rejected_reason'),
		executedAt: timestamp('executed_at', { withTimezone: true }),
		/**
		 * Why status is `failed`: the failing step's message, `'conflict'` when a step's
		 * reviewed baseline no longer matched, or `'interrupted'` when an `executing` row
		 * outlived its lease (the process died between a step and its terminal transition).
		 */
		failureMessage: text('failure_message'),
		/** Auto-expire pending proposals. Stops stale approvals long after the UI context is gone. */
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('agent_proposal_conv_status_idx').on(table.conversationId, table.status),
		// Partial index — only track unresolved proposals for the expiry sweep.
		index('agent_proposal_pending_expiry_idx').on(table.expiresAt).where(sql`${table.status} = 'pending'`),
		// Exactly-once guarantee: at most one row per proposal id is in the
		// `executing` or `executed` state. A double-tap approval collides on
		// this index and the caller reads the existing row instead of racing.
		uniqueIndex('agent_proposal_exec_unique_idx').on(table.id).where(sql`${table.status} IN ('executing', 'executed')`),
	],
);
