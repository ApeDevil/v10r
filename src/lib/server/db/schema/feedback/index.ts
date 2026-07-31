/**
 * FEEDBACK — User-submitted messages from /feedback.
 * Linked to an analytics session when consent allowed it; otherwise sessionId is null.
 * Never auto-expires (user-authored content; admin handles GDPR erasure manually).
 */
import { sql } from 'drizzle-orm';
import { check, index, pgSchema, smallint, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const feedbackSchema = pgSchema('feedback');

export const feedbackStatusEnum = feedbackSchema.enum('feedback_status', ['new', 'read', 'archived']);

export const feedback = feedbackSchema.table(
	'feedback',
	{
		id: text('id').primaryKey(),
		subject: text('subject').notNull(),
		body: text('body').notNull(),
		rating: smallint('rating'),
		contactEmail: text('contact_email'),
		/** '' = "no source". DB default matches the app-layer default so future
		 * insert paths don't have to reproduce the valibot behavior. */
		pageOfOrigin: text('page_of_origin').notNull().default(''),
		sessionId: text('session_id'),
		status: feedbackStatusEnum('status').notNull().default('new'),
		submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
		nonce: text('nonce').notNull(),
	},
	(table) => [
		uniqueIndex('feedback_nonce_idx').on(table.nonce),
		index('feedback_status_submitted_idx').on(table.status, table.submittedAt),
		index('feedback_submitted_idx').on(table.submittedAt),
		check('feedback_rating_range', sql`${table.rating} IS NULL OR (${table.rating} BETWEEN 1 AND 5)`),
		// LOAD-BEARING backstops for the valibot limits (subject ≤120, body ≤4000,
		// source ≤512): a future bulk-import or admin edit path bypassing the form
		// schema cannot write unbounded text. Same doctrine as mcp.call_log.
		check('feedback_subject_len', sql`char_length(${table.subject}) <= 120`),
		check('feedback_body_len', sql`char_length(${table.body}) <= 4000`),
		check('feedback_source_len', sql`char_length(${table.pageOfOrigin}) <= 512`),
	],
);
