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

	locale: text('locale').notNull().default('en'),
	timezone: text('timezone').notNull().default('UTC'),
	dateFormat: dateFormatEnum('date_format').notNull().default('relative'),

	// Accessibility
	reduceMotion: boolean('reduce_motion').notNull().default(false),
	highContrast: boolean('high_contrast').notNull().default(false),

	// Style randomizer
	paletteId: text('palette_id'),
	typographyId: text('typography_id'),
	radiusId: text('radius_id'),

	/**
	 * When the user first saw the post-signup data-transparency page.
	 * NULL (or row absent) = first sign-in pending → app layout redirects once
	 * to /account/data?welcome=1 and consumes this marker atomically.
	 */
	transparencySeenAt: timestamp('transparency_seen_at', { withTimezone: true }),

	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
