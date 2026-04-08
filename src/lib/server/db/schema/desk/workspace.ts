/**
 * DESK WORKSPACE — Named, saveable dock layout configurations.
 *
 * desk.workspace: 1:N from user — each stores a full DockLayoutState as JSONB.
 * desk.workspace_active: 1:1 with user — which workspace is currently selected.
 *
 * Max 9 per user (enforced by CHECK on sort_order 0-8).
 * Layout JSONB is opaque — the recursive split tree is stored as-is.
 */
import { check, index, jsonb, smallint, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from '../auth/_better-auth';
import { deskSchema } from './schema';
import type { DockLayoutState } from '$lib/components/composites/dock/dock.types';

// ── JSONB column type ───────────────────────────────────────────

export type WorkspaceLayoutJson = DockLayoutState;

// ── Workspace (1:N from user) ───────────────────────────────────

export const deskWorkspace = deskSchema.table(
	'workspace',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		layout: jsonb('layout').notNull().$type<WorkspaceLayoutJson>(),
		sortOrder: smallint('sort_order').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex('desk_workspace_user_sort_idx').on(table.userId, table.sortOrder),
		index('desk_workspace_user_idx').on(table.userId),
		check('desk_workspace_sort_range', sql`${table.sortOrder} BETWEEN 0 AND 8`),
	],
);

// ── Active workspace pointer (1:1 with user) ────────────────────

export const deskWorkspaceActive = deskSchema.table('workspace_active', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	workspaceId: text('workspace_id')
		.notNull()
		.references(() => deskWorkspace.id, { onDelete: 'cascade' }),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
