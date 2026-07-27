import * as v from 'valibot';
import { safeParse } from 'valibot';
import { apiPaginated, parsePagination } from '$lib/server/api/pagination';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiCreated, apiValidationError } from '$lib/server/api/response';
import { guardApiUser } from '$lib/server/auth/guards';
import { createSpreadsheetFile } from '$lib/server/db/desk/mutations';
import { listSpreadsheets } from '$lib/server/db/desk/queries';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:desk:spreadsheets', 10, '1 m');

const CreateSchema = v.object({
	name: v.optional(v.pipe(v.string(), v.maxLength(200))),
	cells: v.optional(v.record(v.string(), v.any())),
});

/** List user's spreadsheets. */
export const GET: RequestHandler = async ({ url, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;
	const pagination = parsePagination(url);
	const { items, total } = await listSpreadsheets(user.id, pagination.offset, pagination.pageSize);
	return apiPaginated(items, total, pagination);
};

/** Create a new spreadsheet. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => ({}));
	const parsed = safeParse(CreateSchema, body);
	if (!parsed.success) {
		return apiValidationError(parsed.issues);
	}

	const result = await createSpreadsheetFile(user.id, parsed.output.name, parsed.output.cells);
	return apiCreated(result);
};
