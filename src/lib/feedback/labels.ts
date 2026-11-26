/**
 * Display words for the feedback vocabulary. One map per list, typed by it, so a new state
 * or category without a label is a compile error rather than a raw enum value on screen.
 */
import * as m from '#lib/paraglide/messages.js';
import type { FeedbackCategory } from './category';
import type { FeedbackCloseReason, FeedbackStatus, SubmitterStatus } from './status';

const CATEGORY_LABELS: Record<FeedbackCategory, () => string> = {
	feature: m.feedback_category_feature,
	bug: m.feedback_category_bug,
	improvement: m.feedback_category_improvement,
	general: m.feedback_category_general,
};

const STATUS_LABELS: Record<FeedbackStatus, () => string> = {
	received: m.admin_feedback_status_received,
	deferred: m.admin_feedback_status_deferred,
	accepted: m.admin_feedback_status_accepted,
	in_development: m.admin_feedback_status_in_development,
	ready_for_review: m.admin_feedback_status_ready_for_review,
	release_approved: m.admin_feedback_status_release_approved,
	released: m.admin_feedback_status_released,
	closed: m.admin_feedback_status_closed,
};

const CLOSE_REASON_LABELS: Record<FeedbackCloseReason, () => string> = {
	rejected: m.admin_feedback_close_reason_rejected,
	duplicate: m.admin_feedback_close_reason_duplicate,
	archived: m.admin_feedback_close_reason_archived,
};

const SUBMITTER_STATUS_LABELS: Record<SubmitterStatus, () => string> = {
	received: m.account_feedback_status_received,
	considering: m.account_feedback_status_considering,
	planned: m.account_feedback_status_planned,
	in_progress: m.account_feedback_status_in_progress,
	released: m.account_feedback_status_released,
	closed: m.account_feedback_status_closed,
};

export const feedbackCategoryLabel = (category: FeedbackCategory) => CATEGORY_LABELS[category]();
export const feedbackStatusLabel = (status: FeedbackStatus) => STATUS_LABELS[status]();
export const feedbackCloseReasonLabel = (reason: FeedbackCloseReason) => CLOSE_REASON_LABELS[reason]();
export const submitterStatusLabel = (status: SubmitterStatus) => SUBMITTER_STATUS_LABELS[status]();
