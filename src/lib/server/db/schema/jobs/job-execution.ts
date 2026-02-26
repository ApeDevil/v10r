/**
 * JOB EXECUTION LOG — Immutable event log for scheduled job runs.
 * Records are inserted on completion and NEVER modified.
 * Supports both Vercel cron (HTTP) and container scheduler (setInterval) triggers.
 */
import { pgSchema, text, timestamp, integer, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const jobsSchema = pgSchema('jobs');

export const jobExecutionStatusEnum = jobsSchema.enum('job_execution_status', [
	'success',
	'failure',
]);

export const jobTriggerEnum = jobsSchema.enum('job_trigger', [
	'cron',
	'scheduler',
	'manual',
]);

export const jobExecution = jobsSchema.table(
	'job_execution',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),

		/** Job slug from the registry (e.g., 'session-cleanup') */
		jobSlug: text('job_slug').notNull(),

		status: jobExecutionStatusEnum('status').notNull(),

		/** How this execution was triggered */
		trigger: jobTriggerEnum('trigger').notNull(),

		/** When the job started executing */
		startedAt: timestamp('started_at', { withTimezone: true }).notNull(),

		/** When the job finished executing */
		finishedAt: timestamp('finished_at', { withTimezone: true }).notNull().defaultNow(),

		/** Wall-clock duration in milliseconds */
		durationMs: integer('duration_ms').notNull(),

		/** Job-specific result count (e.g., rows deleted). Null on failure. */
		resultCount: integer('result_count'),

		/** Error message on failure. Null on success. */
		errorMessage: text('error_message'),
	},
	(table) => [
		// Primary query: "last N runs of job X"
		index('job_exec_slug_started_idx').on(table.jobSlug, table.startedAt.desc()),

		// Alerting: "all failures in time range"
		index('job_exec_status_started_idx').on(table.status, table.startedAt.desc()),

		// Retention cleanup: delete by age
		index('job_exec_started_idx').on(table.startedAt),

		// Data integrity: duration can't be negative
		check('duration_positive', sql`${table.durationMs} >= 0`),

		// Data integrity: result_count can't be negative when present
		check('result_count_positive', sql`${table.resultCount} IS NULL OR ${table.resultCount} >= 0`),
	],
);
