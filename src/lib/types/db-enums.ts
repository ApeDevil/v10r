/**
 * Client-side mirror of the closed value sets the DATABASE owns.
 *
 * `$lib/server/db/schema` is server-only by path, so a component can never import a
 * `pgEnum` directly and some mirror is unavoidable. What is avoidable is having ten of
 * them: before this file, `'draft' | 'published' | 'archived'` was retyped inline in ten
 * places and `'light' | 'dark' | 'system'` in seven, each free to drift from the column
 * that actually constrains the value.
 *
 * One declaration per set, and `db-enums.drift.test.ts` asserts each equals its `pgEnum`,
 * order included. The database stays the source of truth; this is its shadow, and the
 * test is what keeps the shadow attached.
 */

export const POST_STATUSES = ['draft', 'published', 'archived'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const COMMENT_STATUSES = ['visible', 'hidden', 'removed'] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];

export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

export const DISPLAY_DENSITIES = ['compact', 'comfortable', 'spacious'] as const;
export type DisplayDensity = (typeof DISPLAY_DENSITIES)[number];

export const DATE_FORMATS = ['relative', 'absolute', 'iso'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

/** Which AI surface a conversation belongs to. See `docs/blueprint/ai/surfaces.md`. */
export const AI_SURFACES = ['chatbot', 'deskbot'] as const;
export type AiSurface = (typeof AI_SURFACES)[number];

export const NOTIFICATION_CHANNELS = ['email', 'telegram', 'discord', 'push'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_TYPES = ['mention', 'comment', 'system', 'success', 'security', 'follow'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const CONSENT_TIERS = ['necessary', 'analytics'] as const;
export type ConsentTier = (typeof CONSENT_TIERS)[number];

export const DESK_FILE_TYPES = ['spreadsheet', 'markdown'] as const;
export type DeskFileType = (typeof DESK_FILE_TYPES)[number];
