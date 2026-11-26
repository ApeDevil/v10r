import { FEEDBACK_CATEGORIES, type FeedbackCategory } from '#lib/feedback/category.ts';
import { FEEDBACK_STATUSES, type FeedbackStatus } from '#lib/feedback/status.ts';
import { getAuditContext } from '#lib/server/admin/index.ts';
import {
	CLOSED_PURGE_DAYS,
	getFeedbackCounts,
	INBOX_CAPACITY,
	INBOX_PAGE_SIZE,
	listFeedback,
	purgeClosedFeedback,
	STORAGE_CEILING,
	STORAGE_WARNING_SHARE,
} from '#lib/server/feedback/index.ts';
import { requireAdmin } from '#lib/server/http/guards.ts';
import type { Actions, PageServerLoad } from './$types';

const isStatus = (value: string | null): value is FeedbackStatus =>
	value !== null && (FEEDBACK_STATUSES as readonly string[]).includes(value);
const isCategory = (value: string | null): value is FeedbackCategory =>
	value !== null && (FEEDBACK_CATEGORIES as readonly string[]).includes(value);

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);

	const statusParam = url.searchParams.get('status');
	const categoryParam = url.searchParams.get('category');
	const status = isStatus(statusParam) ? statusParam : undefined;
	const category = isCategory(categoryParam) ? categoryParam : undefined;
	const offsetParam = Number(url.searchParams.get('offset') ?? '0');
	const offset = Number.isInteger(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

	const [list, counts] = await Promise.all([
		listFeedback({ status, category, limit: INBOX_PAGE_SIZE, offset }),
		getFeedbackCounts(),
	]);

	return {
		title: 'Feedback · Admin',
		...list,
		status,
		category,
		counts,
		purgeDays: CLOSED_PURGE_DAYS,
		storage: {
			ceiling: STORAGE_CEILING,
			warnFrom: Math.floor(STORAGE_CEILING * STORAGE_WARNING_SHARE),
			inboxCapacity: INBOX_CAPACITY,
		},
	};
};

export const actions: Actions = {
	purge: async (event) => {
		const { user } = requireAdmin(event.locals);
		const { deleted } = await purgeClosedFeedback(getAuditContext(user, event.getClientAddress()));
		return { purged: deleted };
	},
};
