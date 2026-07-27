import * as v from 'valibot';
import { safeParse } from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { guardApiUser } from '$lib/server/auth/guards';
import { updateSpreadsheet } from '$lib/server/db/desk/mutations';
import { getSpreadsheet } from '$lib/server/db/desk/queries';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:desk:spreadsheets:update', 30, '1 m');

// Bound the JSON blob so a single authenticated PUT can't persist megabytes of
// cells (storage abuse + read-amplification on every load).
const MAX_CELLS = 50_000;
const MAX_COLUMN_META = 2_000;
const MAX_CELL_VALUE_LEN = 10_000;
const MAX_PAYLOAD_BYTES = 2_000_000;

const cellsRecord = v.pipe(
	v.record(v.string(), v.any()),
	v.check((r) => Object.keys(r).length <= MAX_CELLS, `Too many cells (max ${MAX_CELLS}).`),
	v.check(
		(r) => Object.values(r).every((val) => typeof val !== 'string' || val.length <= MAX_CELL_VALUE_LEN),
		`A cell value exceeds the maximum length (${MAX_CELL_VALUE_LEN}).`,
	),
);

const UpdateSchema = v.pipe(
	v.object({
		name: v.optional(v.pipe(v.string(), v.maxLength(200))),
		cells: v.optional(cellsRecord),
		columnMeta: v.optional(
			v.nullable(
				v.pipe(
					v.record(v.string(), v.any()),
					v.check((r) => Object.keys(r).length <= MAX_COLUMN_META, `Too many columns (max ${MAX_COLUMN_META}).`),
				),
			),
		),
	}),
	v.check((obj) => JSON.stringify(obj).length <= MAX_PAYLOAD_BYTES, 'Payload too large.'),
);

/** Load a spreadsheet by ID. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;
	const row = await getSpreadsheet(params.id, user.id);
	if (!row) return apiError(404, 'not_found', 'Spreadsheet not found.');
	return apiOk({ spreadsheet: row });
};

/** Save/update a spreadsheet. */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

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
