import * as v from 'valibot';
import { apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import type { WorkspaceLayoutJson } from '$lib/server/db/schema/desk/workspace';
import { syncWorkspace } from '$lib/server/desk';
import { SyncWorkspaceSchema } from '$lib/server/desk/schemas';
import type { RequestHandler } from './$types';

/**
 * Atomic save-outgoing + activate-incoming.
 * Also serves as the navigator.sendBeacon target on tab close.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const { user } = requireApiUser(locals);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(SyncWorkspaceSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	const data = parsed.output;
	const result = await syncWorkspace(user.id, {
		save: data.save ? { id: data.save.id, layout: data.save.layout as unknown as WorkspaceLayoutJson } : undefined,
		activate: data.activate,
	});
	return apiOk(result);
};
