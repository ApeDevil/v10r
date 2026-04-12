import * as v from 'valibot';
import { apiError, apiNoContent, apiOk, apiValidationError } from '$lib/server/api/response';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { requireApiUser } from '$lib/server/auth/guards';
import type { WorkspaceLayoutJson } from '$lib/server/db/schema/desk/workspace';
import { deleteWorkspace, updateWorkspace } from '$lib/server/desk';
import { UpdateWorkspaceSchema } from '$lib/server/desk/schemas';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:desk:workspaces:mutate', 30, '1 m');

/** Partial update: name, layout, and/or sortOrder. */
export const PATCH: RequestHandler = async ({ locals, request, params }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(UpdateWorkspaceSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	const workspace = await updateWorkspace(user.id, params.id, {
		...parsed.output,
		layout: parsed.output.layout as WorkspaceLayoutJson | undefined,
	});
	if (!workspace) return apiError(404, 'not_found', 'Workspace not found.');

	return apiOk({
		id: workspace.id,
		name: workspace.name,
		sortOrder: workspace.sortOrder,
		updatedAt: workspace.updatedAt.toISOString(),
	});
};

/** Delete a workspace permanently. */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const { user } = requireApiUser(locals);

	const { success: rlOk, reset } = await limiter.limit(user.id);
	if (!rlOk) return rateLimitResponse(reset);

	const row = await deleteWorkspace(user.id, params.id);
	if (!row) return apiError(404, 'not_found', 'Workspace not found.');

	return apiNoContent();
};
