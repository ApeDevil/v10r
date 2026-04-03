import { json } from '@sveltejs/kit';
import { safeParse } from 'valibot';
import * as v from 'valibot';
import { requireApiUser } from '$lib/server/auth/guards';
import { createSpreadsheet } from '$lib/server/db/desk/mutations';
import { listSpreadsheets } from '$lib/server/db/desk/queries';
import type { RequestHandler } from './$types';

const CreateSchema = v.object({
	name: v.optional(v.pipe(v.string(), v.maxLength(200))),
	cells: v.optional(v.record(v.string(), v.any())),
});

/** List user's spreadsheets. */
export const GET: RequestHandler = async ({ locals }) => {
	const { user } = requireApiUser(locals);
	const rows = await listSpreadsheets(user.id);
	return json({ spreadsheets: rows });
};

/** Create a new spreadsheet. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	const body = await request.json().catch(() => ({}));
	const parsed = safeParse(CreateSchema, body);
	if (!parsed.success) {
		return json({ error: 'Invalid request.' }, { status: 400 });
	}

	const row = await createSpreadsheet(user.id, parsed.output.name, parsed.output.cells);
	return json({ spreadsheet: row }, { status: 201 });
};
