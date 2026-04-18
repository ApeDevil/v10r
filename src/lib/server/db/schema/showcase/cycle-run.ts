/**
 * CYCLE RUN — Self-referential demo entity for the Request Cycle showcase.
 * Each cycle execution creates a row — the showcase demonstrates itself
 * by writing to and reading from this table. Spans are persisted so history
 * entries can fully replay the pipeline animation.
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

		/** The processed result returned to the client (null on error) */
		outputPayload: jsonb('output_payload'),

		/** Full span array — enables full pipeline replay from history */
		spans: jsonb('spans'),

		/** Total wall-clock time for the full server-side cycle */
		totalDurationMs: integer('total_duration_ms'),

		/** Final status of the cycle: success | error */
		status: text('status').notNull(),

		/** Which stage failed, if any */
		errorStage: text('error_stage'),

		/** Human-readable error message */
		errorMessage: text('error_message'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		createdIdx: index('cycle_run_created_idx').on(table.createdAt.desc()),
	}),
);
