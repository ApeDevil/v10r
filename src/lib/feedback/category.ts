/**
 * What a piece of feedback is about. Client-safe: the form's picker and the server's enum
 * (`feedback.feedback_category`) read this one list.
 */
export const FEEDBACK_CATEGORIES = ['feature', 'bug', 'improvement', 'general'] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
