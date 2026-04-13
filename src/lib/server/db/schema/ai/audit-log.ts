/**
 * AGENT AUDIT LOG — Policy-layer decision log (scaffolded stub).
 *
 * Captures governor decisions that don't become `tool_call` rows: blocked
 * calls, approvals, rate-limited attempts, quota rejections. Separate from
 * `tool_call` so `tool_call.result` analytics stay clean (no "fake" rows
 * for things that never ran).
 *
 * **Stub status**: v10r writes one row per governor decision, but there
 * is no query UI, no retention job, and no alerting. Retention is a
 * product decision adopting projects should make for themselves — the
 * template only surfaces the seam.
 */
import { index, jsonb, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { aiSchema, conversation, toolCall } from './conversation';
import { agentProposal } from './proposal';

export const agentAuditLog = aiSchema.table(
	'agent_audit_log',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		conversationId: text('conversation_id').references(() => conversation.id, { onDelete: 'set null' }),
		toolCallId: text('tool_call_id').references(() => toolCall.id, { onDelete: 'set null' }),
		proposalId: text('proposal_id').references(() => agentProposal.id, { onDelete: 'set null' }),
		/** Event class, e.g. `scope_denied`, `rate_limited`, `proposal_approved`. */
		event: text('event').notNull(),
		/** Human-readable decision, e.g. `denied`, `allowed`, `deferred`. */
		decision: text('decision').notNull(),
		/** Full error envelope (audit view) — includes evidence, policy name, raw args. */
		payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('agent_audit_user_created_idx').on(table.userId, table.createdAt),
		index('agent_audit_event_idx').on(table.event),
	],
);
