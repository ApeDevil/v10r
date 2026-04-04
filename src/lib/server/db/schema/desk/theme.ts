/**
 * DESK THEME — User appearance settings for the dock workspace.
 *
 * desk.theme: 1:1 with user — active workspace colors + type styles.
 * desk.theme_preset: 1:N from user — named, saveable theme configurations.
 * Built-in presets (Default, Midnight, Forest) are code constants, never stored.
 */
import { index, jsonb, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { deskSchema } from './schema';

// ── JSONB column types ───────────────────────────────────────────

export type WorkspaceColorsJson = {
	shellBg?: string;
	panelBg?: string;
	shellBorder?: string;
	tabActiveIndicator?: string;
};

export type TypeStylesJson = Record<string, { bg?: string }>;

// ── Active theme (1:1 with user) ─────────────────────────────────

export const deskTheme = deskSchema.table('theme', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	workspace: jsonb('workspace').notNull().default({}).$type<WorkspaceColorsJson>(),
	typeStyles: jsonb('type_styles').notNull().default({}).$type<TypeStylesJson>(),
	activePresetId: text('active_preset_id'),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── User-created presets (1:N from user) ─────────────────────────

export const deskThemePreset = deskSchema.table(
	'theme_preset',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		workspace: jsonb('workspace').notNull().default({}).$type<WorkspaceColorsJson>(),
		typeStyles: jsonb('type_styles').notNull().default({}).$type<TypeStylesJson>(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('desk_theme_preset_user_idx').on(table.userId)],
);
