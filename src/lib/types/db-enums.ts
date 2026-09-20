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

/**
 * The proposal state machine (`ai.agent_proposal.status`): `pending → approved → executing →
 * executed | failed`, with `rejected` and `expired` leaving from `pending`.
 */
export const PROPOSAL_STATUSES = [
	'pending',
	'approved',
	'rejected',
	'executing',
	'executed',
	'failed',
	'expired',
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/** How one executed plan step ended (`ai.agent_proposal_step.kind`). */
export const PROPOSAL_STEP_KINDS = ['ok', 'failed', 'conflict'] as const;
export type ProposalStepKind = (typeof PROPOSAL_STEP_KINDS)[number];

/** The AI vendors an administrator can connect. Order is the resolvers' first-configured order. */
export const AI_PROVIDER_IDS = ['groq', 'openai', 'google'] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

/** The external vendors an administrator can connect for the name check (`name_check.source_connection`). */
export const NAME_SOURCE_VENDORS = ['euipo', 'tavily', 'brave'] as const;
export type NameSourceVendor = (typeof NAME_SOURCE_VENDORS)[number];

export const NOTIFICATION_TYPES = ['mention', 'comment', 'system', 'success', 'security', 'follow'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const CONSENT_TIERS = ['necessary', 'analytics'] as const;
export type ConsentTier = (typeof CONSENT_TIERS)[number];

/**
 * Which authenticated area an `analytics.user_events` row came from. Bounded on
 * purpose: a surface joins this list when a product decision puts it in the
 * identified lane (`docs/blueprint/analytics/two-lane-model.md`).
 */
export const USER_SURFACES = ['account', 'desk'] as const;
export type UserSurface = (typeof USER_SURFACES)[number];

export const DESK_FILE_TYPES = ['spreadsheet', 'markdown'] as const;
export type DeskFileType = (typeof DESK_FILE_TYPES)[number];
