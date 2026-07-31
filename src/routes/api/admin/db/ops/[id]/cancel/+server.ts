import { getAuditContext, recordAuditEvent } from '$lib/server/admin';
import { apiError, apiOk } from '$lib/server/api/response';
import { guardApiAdmin } from '$lib/server/auth/guards';
import { cancelRun } from '$lib/server/dbops';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const guard = guardApiAdmin(event.locals);
	if ('error' in guard) return guard.error;

	const run = await cancelRun(event.params.id);
	if (!run) return apiError(404, 'not_found', 'Run not found');

	const ctx = getAuditContext(event.locals.user, event.getClientAddress());
	await recordAuditEvent({ ...ctx, action: 'dbops.cancel', targetType: 'dbops_run', targetId: run.id });
	return apiOk(run);
};
