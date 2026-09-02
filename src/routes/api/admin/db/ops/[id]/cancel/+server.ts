import { getAuditContext, recordAuditEvent } from '$lib/server/admin';
import { cancelOperation } from '$lib/server/dbops';
import { guardApiAdmin } from '$lib/server/http/guards';
import { apiError, apiOk } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const guard = guardApiAdmin(event.locals);
	if ('error' in guard) return guard.error;

	const operation = await cancelOperation(event.params.id);
	if (!operation) return apiError(404, 'not_found', 'Operation not found');

	const ctx = getAuditContext(event.locals.user, event.getClientAddress());
	await recordAuditEvent({ ...ctx, action: 'dbops.cancel', targetType: 'dbops_operation', targetId: operation.id });
	return apiOk(operation);
};
