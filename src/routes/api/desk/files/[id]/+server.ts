import * as v from 'valibot';
import { parseCellRef } from '$lib/desk/formula';
import {
	deleteFile,
	duplicateSpreadsheetFile,
	moveFile,
	renameFile,
	toggleFileAiContext,
	updateSpreadsheetByFileId,
} from '$lib/server/db/desk/mutations';
import { getFile, getSpreadsheetByFileId } from '$lib/server/db/desk/queries';
import { guardApiUser } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiCreated, apiError, apiNoContent, apiOk, apiValidationError } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

/** Constrained meta value — allows primitives and shallow objects, capped by JSON size. */
const MetaValue = v.union([v.string(), v.number(), v.boolean(), v.null()]);
const MetaObject = v.record(v.string(), MetaValue);
/** `PersistedCell`, keyed by an address the grid can show — `recalculateCells` refuses any other. */
const PersistedCellSchema = v.object({
	v: v.union([v.string(), v.number(), v.null()]),
	f: v.optional(v.string()),
	t: v.optional(v.string()),
});
const CellAddress = v.pipe(
	v.string(),
	v.check((label) => parseCellRef(label.toUpperCase()) !== null, 'Not a cell address'),
);
const MAX_CELLS_JSON = 500_000; // ~500KB max

const limiter = createLimiter('rl:desk:files:mutate', 30, '1 m');

const UpdateFileSchema = v.object({
	expectedVersion: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
	name: v.optional(v.pipe(v.string(), v.maxLength(200))),
	folderId: v.optional(v.nullable(v.string())),
	aiContext: v.optional(v.boolean()),
	cells: v.optional(
		v.pipe(
			v.record(CellAddress, PersistedCellSchema),
			v.check((v) => JSON.stringify(v).length <= MAX_CELLS_JSON, 'Cell data too large'),
		),
	),
	columnMeta: v.optional(
		v.nullable(
			v.pipe(
				v.record(v.string(), MetaObject),
				v.check((v) => JSON.stringify(v).length <= MAX_CELLS_JSON, 'Column meta too large'),
			),
		),
	),
});

/** Get a file with its detail data. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;
	const fileRow = await getFile(params.id, user.id);
	if (!fileRow) return apiError(404, 'not_found', 'Not found.');

	if (fileRow.type === 'spreadsheet') {
		const result = await getSpreadsheetByFileId(params.id, user.id);
		if (!result) return apiError(404, 'not_found', 'Not found.');
		return apiOk({ file: result.file, spreadsheet: result.spreadsheet });
	}

	return apiOk({ file: fileRow });
};

/** Update a file (rename, move, toggle AI context) and/or its detail data. */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(UpdateFileSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	const { name, folderId, aiContext, cells, columnMeta, expectedVersion } = parsed.output;
	const hasCellUpdate = cells !== undefined || columnMeta !== undefined;
	// Reject before any metadata mutation: a stale content request has no side effects.
	if (hasCellUpdate) {
		if (expectedVersion === undefined) return apiError(400, 'version_required', 'expectedVersion is required.');
		if (folderId !== undefined || aiContext !== undefined) {
			return apiError(400, 'mixed_update', 'Move and AI context changes must be sent separately from cell changes.');
		}
		const result = await updateSpreadsheetByFileId(params.id, user.id, { ...parsed.output, expectedVersion });
		if (!result) return apiError(404, 'not_found', 'Not found.');
		if (result.status === 'conflict') {
			return apiError(409, 'version_conflict', 'Spreadsheet changed elsewhere. Your changes were not saved.');
		}
		return apiOk({ file: result.file, version: result.version });
	}

	// Handle move
	if (folderId !== undefined) {
		const row = await moveFile(params.id, user.id, folderId);
		if (!row) return apiError(404, 'not_found', 'Not found.');
	}

	// Handle AI context toggle
	if (aiContext !== undefined) {
		const row = await toggleFileAiContext(params.id, user.id, aiContext);
		if (!row) return apiError(404, 'not_found', 'Not found.');
	}

	// Handle rename (no cell data)
	if (name !== undefined && !hasCellUpdate) {
		const row = await renameFile(params.id, user.id, name);
		if (!row) return apiError(404, 'not_found', 'Not found.');
		return apiOk({ file: row });
	}

	// If only moved or toggled AI context, re-fetch
	if (folderId !== undefined || aiContext !== undefined) {
		const row = await getFile(params.id, user.id);
		return apiOk({ file: row });
	}

	return apiError(400, 'no_fields', 'No update fields provided.');
};

/** Duplicate a file. */
export const POST: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success: rlOk, reset } = await limiter.limit(user.id);
	if (!rlOk) return rateLimitResponse(reset);
	const result = await duplicateSpreadsheetFile(params.id, user.id);
	if (!result) return apiError(404, 'not_found', 'Not found.');
	return apiCreated({ file: result.file, spreadsheet: result.spreadsheet });
};

/** Delete a file (cascades to detail table). */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success: rlDel, reset: rlReset } = await limiter.limit(user.id);
	if (!rlDel) return rateLimitResponse(rlReset);
	const row = await deleteFile(params.id, user.id);
	if (!row) return apiError(404, 'not_found', 'Not found.');
	return apiNoContent();
};
