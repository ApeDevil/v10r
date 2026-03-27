/**
 * CUSTOM PALETTES — User-created color palettes based on preset modifications.
 */
import { index, integer, jsonb, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { appSchema } from './user-preferences';

export const customPalettes = appSchema.table(
	'custom_palettes',
	{
		id: text('id').primaryKey(), // CP_{nanoid(12)}
		name: text('name').notNull(),
		description: text('description').notNull().default(''),
		basePaletteId: text('base_palette_id').notNull(), // P0-P7 source preset
		lightColors: jsonb('light_colors').notNull().$type<Record<string, string>>(),
		darkColors: jsonb('dark_colors').notNull().$type<Record<string, string>>(),
		accentOffset: integer('accent_offset').notNull().default(0),
		createdBy: text('created_by')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('custom_palettes_created_by_idx').on(table.createdBy)],
);
