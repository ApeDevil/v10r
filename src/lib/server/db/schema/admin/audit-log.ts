/**
 * ADMIN AUDIT LOG — Immutable event log for all admin actions.
 * Records are inserted and NEVER modified. No FK on actor_id
 * to ensure audit trail survives user deletion.
 */
import { index, integer, jsonb, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

export const adminSchema = pgSchema('admin');

export const adminAuditLog = adminSchema.table(
	'audit_log',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),

		/** Action identifier, e.g. 'user.ban', 'flag.toggle', 'job.trigger' */
		action: text('action').notNull(),

		/** Admin who performed the action (no FK — survives user deletion) */
		actorId: text('actor_id').notNull(),

		/** Denormalized for display without join */
		actorEmail: text('actor_email').notNull(),

		/** Entity type acted upon, e.g. 'user', 'feature_flag', 'job' */
		targetType: text('target_type'),

		/** ID of the affected entity */
		targetId: text('target_id'),

		/** Action-specific payload: { before, after, meta } */
		detail: jsonb('detail'),

		/** Client IP address */
		ipAddress: text('ip_address'),

		occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('admin_audit_occurred_idx').on(table.occurredAt.desc()),
		index('admin_audit_actor_idx').on(table.actorId, table.occurredAt.desc()),
		index('admin_audit_target_idx').on(table.targetType, table.targetId, table.occurredAt.desc()),
		index('admin_audit_action_idx').on(table.action),
	],
);
