/**
 * AUDIT LOG — pgEnum, bytea, serial/bigserial types.
 * Mutability pattern: Immutable event log.
 * Records are inserted and NEVER modified.
 */
import { bigserial, index, integer, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { showcaseSchema, typeSpecimen } from './type-specimen';

/**
 * pgEnum: creates a real PostgreSQL ENUM type.
 * Smaller storage (4 bytes), type safety at DB level, self-documenting.
 * Caveat: adding values requires ALTER TYPE, can't remove without recreation.
 */
export const auditActionEnum = showcaseSchema.enum('audit_action', [
	'create',
	'update',
	'delete',
	'restore',
	'export',
	'import',
	'login',
	'logout',
]);

export const auditSeverityEnum = showcaseSchema.enum('audit_severity', [
	'debug',
	'info',
	'warning',
	'error',
	'critical',
]);

export const auditLog = showcaseSchema.table(
	'audit_log',
	{
		/** serial (4 bytes): auto-incrementing integer */
		id: serial('id').primaryKey(),

		/** bigserial (8 bytes): for tables that grow indefinitely */
		sequenceNum: bigserial('sequence_num', { mode: 'number' }).notNull().unique(),

		action: auditActionEnum('action').notNull(),
		severity: auditSeverityEnum('severity').notNull().default('info'),

		/** Which specimen this event relates to (nullable) */
		specimenId: integer('specimen_id').references(() => typeSpecimen.id, {
			onDelete: 'set null',
		}),

		actorId: text('actor_id').notNull().default('system'),
		description: text('description').notNull(),

		/** Correlation ID for tracing events across systems */
		correlationId: uuid('correlation_id').defaultRandom(),

		/** Immutable: only occurredAt, no updatedAt */
		occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		specimenIdx: index('audit_specimen_id_idx').on(table.specimenId),
		actorIdx: index('audit_actor_id_idx').on(table.actorId),
		occurredIdx: index('audit_occurred_at_idx').on(table.occurredAt.desc()),
		actionIdx: index('audit_action_idx').on(table.action),
	}),
);
