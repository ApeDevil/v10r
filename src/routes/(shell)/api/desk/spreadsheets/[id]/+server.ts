import { json } from '@sveltejs/kit';
import { safeParse } from 'valibot';
import * as v from 'valibot';
import { requireApiUser } from '$lib/server/auth/guards';
import { updateSpreadsheet } from '$lib/server/db/desk/mutations';
import { getSpreadsheet } from '$lib/server/db/desk/queries';
import type { RequestHandler } from './$types';

const UpdateSchema = v.object({
	name: v.optional(v.pipe(v.string(), v.maxLength(200))),
	cells: v.optional(v.record(v.string(), v.any())),
	columnMeta: v.optional(v.nullable(v.record(v.string(), v.any()))),
});

/** Load a spreadsheet by ID. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);
	const row = await getSpreadsheet(params.id, user.id);
	if (!row) return json({ error: 'Not found.' }, { status: 404 });
	return json({ spreadsheet: row });
};

/** Save/update a spreadsheet. */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiUser(locals);

	const body = await request.json().catch(() => null);
	if (!body) return json({ error: 'Invalid request body.' }, { status: 400 });

	const parsed = safeParse(UpdateSchema, body);
	if (!parsed.success) {
		return json({ error: 'Invalid request.' }, { status: 400 });
	}

	const row = await updateSpreadsheet(params.id, user.id, parsed.output);
	if (!row) return json({ error: 'Not found.' }, { status: 404 });
	return json({ spreadsheet: row });
};
