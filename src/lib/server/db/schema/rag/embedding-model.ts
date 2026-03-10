/**
 * EMBEDDING MODEL — Registry of embedding models used to generate vectors.
 * Tracks which model produced each embedding for future migration support.
 */
import { boolean, integer, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

export const ragSchema = pgSchema('rag');

export const embeddingModel = ragSchema.table('embedding_model', {
	id: text('id').primaryKey(),
	provider: text('provider').notNull(),
	modelName: text('model_name').notNull(),
	dimensions: integer('dimensions').notNull(),
	maxTokens: integer('max_tokens'),
	isDefault: boolean('is_default').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
