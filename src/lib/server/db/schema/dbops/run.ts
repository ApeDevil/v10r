import { sql } from 'drizzle-orm';
import { index, jsonb, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * `dbops` — operations ledger for database branch operations (Neon-only v1).
 *
 * One row per refresh ("reset dev branch from parent") operation. The row is a
 * mutable process record (queued→running→terminal), polled live by the monitor
 * — closer to the `ai.agent_proposal` lifecycle table than the write-once
 * `jobs.job_execution` log. No FKs (actor is plain text, survives user deletion).
 */
export const dbopsSchema = pgSchema('dbops');

// Enums declared ON the dbops schema (never `public` — push excludes public).
export const dbopsRunStatusEnum = dbopsSchema.enum('dbops_run_status', [
	'queued',
	'running',
	'succeeded',
	'failed',
	'canceled',
]);

export const dbopsRunKindEnum = dbopsSchema.enum('dbops_run_kind', ['reset_from_parent']);

export const dbopsRunTriggerEnum = dbopsSchema.enum('dbops_run_trigger', ['manual', 'scheduled']);

export const dbopsRun = dbopsSchema.table(
	'run',
	{
		id: text('id').primaryKey(), // createId.dbRun → 'dbr_…'
		kind: dbopsRunKindEnum('kind').notNull().default('reset_from_parent'),
		status: dbopsRunStatusEnum('status').notNull().default('running'),
		trigger: dbopsRunTriggerEnum('trigger').notNull(),

		// Neon linkage — IDs only, never connection strings.
		devBranchId: text('dev_branch_id').notNull(),
		parentBranchId: text('parent_branch_id').notNull(),
		neonOperationIds: text('neon_operation_ids').array().notNull().default(sql`'{}'`),
		neonOpStatuses: jsonb('neon_op_statuses').$type<Record<string, string>>(),

		// Dedupe a double-clicked/retried request. NULL for system-triggered runs.
		idempotencyKey: text('idempotency_key'),

		// Actor — no FK (ledger outlives the account).
		actorId: text('actor_id').notNull(),
		actorEmail: text('actor_email').notNull(),

		// Sanitized failure detail.
		error: jsonb('error').$type<{ message: string; at: string } | null>(),

		// Heartbeat lease — a sweep fails runs whose lease lapsed (crashed executor).
		leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		finishedAt: timestamp('finished_at', { withTimezone: true }),
	},
	(table) => [
		index('dbops_run_created_idx').on(table.createdAt.desc()),
		index('dbops_run_status_idx').on(table.status, table.createdAt.desc()),
		// Concurrency lock: at most one in-flight refresh at a time.
		uniqueIndex('dbops_run_active_unique_idx').on(table.kind).where(sql`${table.status} IN ('queued', 'running')`),
		// Idempotency: at most one row per key (NULLs allowed/duplicated).
		uniqueIndex('dbops_run_idem_unique_idx').on(table.idempotencyKey).where(sql`${table.idempotencyKey} IS NOT NULL`),
		// Reaper sweep predicate.
		index('dbops_run_lease_idx').on(table.leaseExpiresAt).where(sql`${table.status} = 'running'`),
	],
);

export type DbopsRun = typeof dbopsRun.$inferSelect;
export type NewDbopsRun = typeof dbopsRun.$inferInsert;
