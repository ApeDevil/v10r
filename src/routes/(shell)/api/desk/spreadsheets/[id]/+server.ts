import * as v from 'valibot';
import { safeParse } from 'valibot';
import { apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { requireApiUser } from '$lib/server/auth/guards';
import { updateSpreadsheet } from '$lib/server/db/desk/mutations';
import { getSpreadsheet } from '$lib/server/db/desk/queries';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:desk:spreadsheets:update', 30, '1 m');

const UpdateSchema = v.object({
	name: v.optional(v.pipe(v.string(), v.maxLength(200))),
	cells: v.optional(v.record(v.string(), v.any())),
	columnMeta: v.optional(v.nullable(v.record(v.string(), v.any()))),
});

/** Load a spreadsheet by ID. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);
	const row = await getSpreadsheet(params.id, user.id);
	if (!row) return apiError(404, 'not_found', 'Spreadsheet not found.');
	return apiOk({ spreadsheet: row });
};

/** Save/update a spreadsheet. */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Invalid request body.');

	const parsed = safeParse(UpdateSchema, body);
	if (!parsed.success) {
		return apiValidationError(parsed.issues);
	}

	const row = await updateSpreadsheet(params.id, user.id, parsed.output);
	if (!row) return apiError(404, 'not_found', 'Spreadsheet not found.');
	return apiOk({ spreadsheet: row });
};
