import { requireAdmin } from '$lib/server/auth/guards';
import { getFeedbackCounts, listFeedback, setFeedbackStatus } from '$lib/server/feedback';
import type { Actions, PageServerLoad } from './$types';

const VALID_STATUSES = new Set(['new', 'read', 'archived'] as const);
type FeedbackStatus = 'new' | 'read' | 'archived';

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);

	const statusParam = url.searchParams.get('status');
	const status =
		statusParam && VALID_STATUSES.has(statusParam as FeedbackStatus) ? (statusParam as FeedbackStatus) : undefined;
	const offsetParam = Number(url.searchParams.get('offset') ?? '0');
	const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

	const [list, counts] = await Promise.all([listFeedback({ status, limit: 50, offset }), getFeedbackCounts()]);

	return { title: 'Feedback · Admin', ...list, status, counts };
};

export const actions: Actions = {
	updateStatus: async ({ request, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const id = String(data.get('id') ?? '');
		const status = String(data.get('status') ?? '');
		if (!id || !VALID_STATUSES.has(status as FeedbackStatus)) {
			return { ok: false };
		}
		await setFeedbackStatus(id, status as FeedbackStatus);
		return { ok: true };
	},
};
