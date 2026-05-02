import { error } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth/guards';
import { deleteFeedback, getFeedback, getFeedbackJourney, setFeedbackStatus } from '$lib/server/feedback';
import type { Actions, PageServerLoad } from './$types';

const VALID_STATUSES = new Set(['new', 'read', 'archived'] as const);
type FeedbackStatus = 'new' | 'read' | 'archived';

export const load: PageServerLoad = async ({ params, locals }) => {
	requireAdmin(locals);

	const item = await getFeedback(params.id);
	if (!item) error(404, 'Not Found');

	const journey = await getFeedbackJourney(item.sessionId);

	// Auto-mark new submissions as read on first view.
	if (item.status === 'new') {
		await setFeedbackStatus(item.id, 'read');
		item.status = 'read';
	}

	return { title: `${item.subject} · Feedback · Admin`, item, journey };
};

export const actions: Actions = {
	updateStatus: async ({ request, params, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const status = String(data.get('status') ?? '');
		if (!VALID_STATUSES.has(status as FeedbackStatus)) return { ok: false };
		await setFeedbackStatus(params.id, status as FeedbackStatus);
		return { ok: true };
	},
	delete: async ({ params, locals }) => {
		requireAdmin(locals);
		await deleteFeedback(params.id);
		return { ok: true };
	},
};
