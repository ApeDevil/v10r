import { getDistinctActions, queryAuditLog } from '$lib/server/admin';
import { requireAdmin } from '$lib/server/http/guards';
import { readUrlState } from '$lib/state/url-state';
import type { PageServerLoad } from './$types';
import { auditListParams } from './list-params';

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);

	const params = readUrlState(url.searchParams, auditListParams);
	const action = params.action || undefined;
	const actor = params.actor || undefined;
	const targetType = params.target_type || undefined;
	const dateFrom = params.from || undefined;
	const dateTo = params.to || undefined;
	const page = params.page;

	const [result, distinctActions] = await Promise.all([
		queryAuditLog({ action, actorId: actor, targetType, dateFrom, dateTo, page }),
		getDistinctActions(),
	]);

	return {
		title: 'Audit Log',
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
