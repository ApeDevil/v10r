/**
 * AI CONVERSATION — Chat history persistence.
 * Stores conversations and messages scoped to authenticated users.
 */
import { pgSchema, text, timestamp, index } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';

export const aiSchema = pgSchema('ai');

export const conversation = aiSchema.table(
	'conversation',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: text('title').notNull().default('New conversation'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('conversation_user_id_idx').on(table.userId),
		index('conversation_updated_at_idx').on(table.updatedAt),
	],
);

export const message = aiSchema.table(
	'message',
	{
		id: text('id').primaryKey(),
		conversationId: text('conversation_id')
			.notNull()
			.references(() => conversation.id, { onDelete: 'cascade' }),
		role: text('role').notNull(),
		content: text('content').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('message_conversation_id_idx').on(table.conversationId),
		index('message_created_at_idx').on(table.createdAt),
	],
);
