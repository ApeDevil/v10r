/**
 * SYSTEM CONFIG — Runtime-mutable settings (feature flags, maintenance mode, etc.).
 * Deliberately simple: key-value with JSONB. No percentage rollouts or user targeting.
 * Covers Fowler's ops + permission toggle types only.
 */
import { jsonb, text, timestamp } from 'drizzle-orm/pg-core';
import { adminSchema } from './audit-log';

export const systemConfig = adminSchema.table('system_config', {
	/** Unique key, e.g. 'maintenance_mode', 'feature.ai_chat' */
	key: text('key').primaryKey(),

	/** Setting value (boolean, object, etc.) */
	value: jsonb('value').notNull(),

	/** Human-readable explanation */
	description: text('description'),

	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

	/** Admin who last changed this setting (no FK — survives user deletion) */
	updatedBy: text('updated_by'),
});
