import * as v from 'valibot';
import { startOperationSchema } from '$lib/schemas/dbops/operation';
import { getAuditContext, recordAuditEvent } from '$lib/server/admin';
import { createId } from '$lib/server/db/id';
import { ConflictError, listOperations, NotConfiguredError, RefusedError, startOperation } from '$lib/server/dbops';
import { guardApiAdmin } from '$lib/server/http/guards';
import { paginatedResponse, parseCursor, parseLimit } from '$lib/server/http/pagination';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiOk, apiValidationError } from '$lib/server/http/response';
import { TargetsError } from '$lib/server/neon';
import type { RequestHandler } from './$types';

const startLimiter = createLimiter('dbops-start', 5, '1 m');

export const POST: RequestHandler = async (event) => {
	const guard = guardApiAdmin(event.locals);
	if ('error' in guard) return guard.error;

	const { success, reset } = await startLimiter.limit(`dbops:${guard.user.id}`);
	if (!success) return rateLimitResponse(reset);

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		body = {};
	}
	const parsed = v.safeParse(startOperationSchema, body ?? {});
	if (!parsed.success) return apiValidationError(parsed.issues);

	const ctx = getAuditContext(event.locals.user, event.getClientAddress());
	try {
		const { operation, replayed } = await startOperation({
			kind: parsed.output.kind,
			trigger: 'manual',
			actorId: ctx.actorId,
			actorEmail: ctx.actorEmail,
			idempotencyKey: event.request.headers.get('idempotency-key') ?? createId.uuid(),
		});
		await recordAuditEvent({
			...ctx,
			action: 'dbops.start',
			targetType: 'dbops_operation',
			targetId: operation.id,
			detail: { kind: operation.kind, status: operation.status },
		});
		return apiOk(operation, replayed ? 200 : 202);
	} catch (err) {
		if (err instanceof NotConfiguredError) return apiError(503, 'not_configured', err.message);
		if (err instanceof ConflictError) return apiError(409, 'operation_in_flight', err.message);
		if (err instanceof RefusedError) return apiError(422, 'operation_refused', err.message);
		if (err instanceof TargetsError) return apiError(422, 'targets_unresolved', err.message);
		throw err;
	}
};

export const GET: RequestHandler = async (event) => {
	const guard = guardApiAdmin(event.locals);
	if ('error' in guard) return guard.error;

	const limit = parseLimit(event.url);
	const raw = parseCursor(event.url);
	const cursor =
		raw && typeof raw.createdAt === 'string' && typeof raw.id === 'string'
			? { createdAt: raw.createdAt, id: raw.id }
			: null;

	const items = await listOperations(limit, cursor);
	return apiOk(paginatedResponse(items, limit, (r) => ({ createdAt: r.createdAt, id: r.id })));
};
