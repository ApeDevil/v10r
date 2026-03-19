/**
 * BRAND SETTINGS — Singleton table for corporate design configuration.
 * Controls whether visitors see a fixed brand style or random demo styles.
 */
import { boolean, text, timestamp } from 'drizzle-orm/pg-core';
import { appSchema } from './user-preferences';

export const brandSettings = appSchema.table('brand_settings', {
	id: text('id').primaryKey().default('default'),
	paletteId: text('palette_id').notNull().default('P1'),
	typographyId: text('typography_id').notNull().default('T1'),
	radiusId: text('radius_id').notNull().default('R2'),
	enabled: boolean('enabled').notNull().default(false),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
