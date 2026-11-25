/**
 * Client-side mirror of the closed value sets the DATABASE owns.
 *
 * `#lib/server/db/schema/index.ts` is server-only by path, so a component can never import a
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

/**
 * The undo of an executed plan (`ai.agent_proposal.revert_status`): null until a revert is
 * claimed, then `reverting → reverted | revert_failed`. One revert per proposal.
 */
export const PROPOSAL_REVERT_STATUSES = ['reverting', 'reverted', 'revert_failed'] as const;
export type ProposalRevertStatus = (typeof PROPOSAL_REVERT_STATUSES)[number];

/**
 * One external operation's lifecycle (`ai.agent_external_operation.status`): `pending` until the
 * approval is claimed, `claimed` while v10r re-verifies, `dispatched` from the moment the request
 * may leave, then one of the four outcomes. A claim is never released back to `pending`.
 */
export const EXTERNAL_OPERATION_STATUSES = [
	'pending',
	'claimed',
	'dispatched',
	'succeeded',
	'failed',
	'unknown',
	'refused',
] as const;
export type ExternalOperationStatus = (typeof EXTERNAL_OPERATION_STATUSES)[number];

/** What the wire saw of one external operation (`ai.agent_external_operation.delivery`). */
export const EXTERNAL_DELIVERIES = ['not_sent', 'sent', 'possibly_sent'] as const;
export type ExternalOperationDelivery = (typeof EXTERNAL_DELIVERIES)[number];

/** The protocols an external operation speaks (`ai.agent_external_operation.protocol`). */
export const EXTERNAL_PROTOCOLS = ['mcp', 'a2a'] as const;
export type ExternalOperationProtocol = (typeof EXTERNAL_PROTOCOLS)[number];

/** Whether the operator states a peer tool's effect can be undone (`ai.mcp_peer_tool.reversibility`). */
export const EXTERNAL_REVERSIBILITIES = ['reversible', 'compensatable', 'irreversible', 'unknown'] as const;

/** Who may call an MCP peer's activated tools (`ai.mcp_peer.audience`). */
export const MCP_PEER_AUDIENCES = ['admin', 'user'] as const;
export type McpPeerAudience = (typeof MCP_PEER_AUDIENCES)[number];

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

export const DESK_FILE_TYPES = ['spreadsheet', 'markdown', 'record'] as const;
export type DeskFileType = (typeof DESK_FILE_TYPES)[number];
