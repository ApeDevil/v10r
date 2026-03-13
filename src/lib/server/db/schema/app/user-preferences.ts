/**
 * USER PREFERENCES — Per-user display and accessibility settings.
 * Extends auth.user with app-specific preferences.
 */
import { boolean, pgSchema, smallint, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';

export const appSchema = pgSchema('app');

export const themeEnum = appSchema.enum('theme', ['light', 'dark', 'system']);
export const displayDensityEnum = appSchema.enum('display_density', ['compact', 'comfortable', 'spacious']);
export const dateFormatEnum = appSchema.enum('date_format', ['relative', 'absolute', 'iso']);

export const userPreferences = appSchema.table('user_preferences', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),

	// Appearance
	theme: themeEnum('theme').notNull().default('system'),
	displayDensity: displayDensityEnum('display_density').notNull().default('comfortable'),
	sidebarWidth: smallint('sidebar_width').notNull().default(240),

	// Locale
	locale: text('locale').notNull().default('en'),
	timezone: text('timezone').notNull().default('UTC'),
	dateFormat: dateFormatEnum('date_format').notNull().default('relative'),

	// Accessibility
	reduceMotion: boolean('reduce_motion').notNull().default(false),
	highContrast: boolean('high_contrast').notNull().default(false),

	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const PREFERENCE_DEFAULTS = {
	theme: 'system',
	displayDensity: 'comfortable',
	sidebarWidth: 240,
	locale: 'en',
	timezone: 'UTC',
	dateFormat: 'relative',
	reduceMotion: false,
	highContrast: false,
} as const;
