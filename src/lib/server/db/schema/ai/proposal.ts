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
 * returns its cached result instead of re-running the payload.
 *
 * See `docs/blueprint/ai/harness-lens.md` for the broader context.
 */

import { sql } from 'drizzle-orm';
import { index, jsonb, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { aiSchema, conversation, message } from './conversation';

// ── Enums ───────────────────────────────────────────────────────────

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

// ── JSONB Types ─────────────────────────────────────────────────────

/** A single proposed tool call inside a proposal's payload. */
export type ProposedToolCall = {
	toolName: string;
	args: Record<string, unknown>;
	/** Optional model-supplied rationale for this specific step. */
	rationale?: string;
};

/** Execution outcome cached on the proposal after a successful run. */
export type ProposalExecutionResult = {
	toolCallIds: string[];
	/** Per-step results, in the order they were executed. */
	results: Array<{ toolName: string; ok: boolean; output: unknown; errorMessage?: string }>;
};

// ── Table ───────────────────────────────────────────────────────────

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
		/** Model's explanation of the plan — shown in the PlanCard UI. */
		rationale: text('rationale').notNull().default(''),
		/** Who approved the proposal, if approved. */
		approvedBy: text('approved_by').references(() => user.id, { onDelete: 'set null' }),
		approvedAt: timestamp('approved_at', { withTimezone: true }),
		rejectedReason: text('rejected_reason'),
		/** Cached execution result; populated when status transitions to `executed`. */
		executionResult: jsonb('execution_result').$type<ProposalExecutionResult | null>(),
		executedAt: timestamp('executed_at', { withTimezone: true }),
		/** Failure message when status is `failed`. */
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
