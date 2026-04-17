/**
 * CYCLE RUN — Self-referential demo entity for the Request Cycle showcase.
 * Each cycle execution creates a row — the showcase demonstrates itself
 * by writing to and reading from this table.
 */

import { index, integer, jsonb, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { showcaseSchema } from './type-specimen';

export const cycleRun = showcaseSchema.table(
	'cycle_run',
	{
		id: serial('id').primaryKey(),

		/** Which trigger path created this run: form action, API fetch, or AI chat */
		trigger: text('trigger').notNull(),

		/** The user-submitted data that started this cycle */
		inputPayload: jsonb('input_payload').notNull(),

		/** The processed result returned to the client */
		outputPayload: jsonb('output_payload'),

		/** Total wall-clock time for the full server-side cycle */
		totalDurationMs: integer('total_duration_ms'),

		/** Final status of the cycle: pending → success | error */
		status: text('status').notNull().default('pending'),

		/** Which stage failed, if any (server, domain, database) */
		errorStage: text('error_stage'),

		/** Human-readable error message */
		errorMessage: text('error_message'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		createdIdx: index('cycle_run_created_idx').on(table.createdAt.desc()),
	}),
);
