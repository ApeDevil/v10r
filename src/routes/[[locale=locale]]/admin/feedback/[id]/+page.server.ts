import { error } from '@sveltejs/kit';
import { deleteFeedback, getFeedback, getFeedbackJourney, setFeedbackStatus } from '$lib/server/feedback';
import { requireAdmin } from '$lib/server/http/guards';
import type { Actions, PageServerLoad } from './$types';

const VALID_STATUSES = new Set(['new', 'read', 'archived'] as const);
type FeedbackStatus = 'new' | 'read' | 'archived';

export const load: PageServerLoad = async ({ params, locals }) => {
	requireAdmin(locals);

	const item = await getFeedback(params.id);
	if (!item) error(404, 'Not Found');

	// The journey read and the auto-mark-read write are independent (both key off
	// the already-loaded item) — overlap them instead of running serially.
	const wasNew = item.status === 'new';
	const [journey] = await Promise.all([
		getFeedbackJourney(item.sessionId),
		wasNew ? setFeedbackStatus(item.id, 'read') : Promise.resolve(),
	]);
	if (wasNew) item.status = 'read';

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
