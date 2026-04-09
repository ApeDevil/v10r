import { getDistinctActions, queryAuditLog } from '$lib/server/admin';
import { requireAdmin } from '$lib/server/auth/guards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);

	const action = url.searchParams.get('action') || undefined;
	const actor = url.searchParams.get('actor') || undefined;
	const targetType = url.searchParams.get('target_type') || undefined;
	const dateFrom = url.searchParams.get('from') || undefined;
	const dateTo = url.searchParams.get('to') || undefined;
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const [result, distinctActions] = await Promise.all([
		queryAuditLog({ action, actorId: actor, targetType, dateFrom, dateTo, page }),
		getDistinctActions(),
	]);

	return {
		entries: result.entries,
		page: result.page,
		totalPages: result.totalPages,
		filters: {
			action: action ?? '',
			actor: actor ?? '',
			targetType: targetType ?? '',
			dateFrom: dateFrom ?? '',
			dateTo: dateTo ?? '',
		},
		distinctActions,
	};
};
