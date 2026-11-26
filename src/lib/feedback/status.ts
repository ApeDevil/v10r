/**
 * The feedback lifecycle's vocabulary, client-safe. The server enums
 * (`feedback.feedback_status`, `feedback.feedback_close_reason`) are built from these lists,
 * so the admin filters and labels cannot drift from the database.
 */
export const FEEDBACK_STATUSES = [
	'received',
	'deferred',
	'accepted',
	'in_development',
	'ready_for_review',
	'release_approved',
	'released',
	'closed',
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_CLOSE_REASONS = ['rejected', 'duplicate', 'archived'] as const;

export type FeedbackCloseReason = (typeof FEEDBACK_CLOSE_REASONS)[number];

/** What the submitter sees on "My feedback": coarse, no admin working detail. */
export const SUBMITTER_STATUSES = ['received', 'considering', 'planned', 'in_progress', 'released', 'closed'] as const;

export type SubmitterStatus = (typeof SUBMITTER_STATUSES)[number];
