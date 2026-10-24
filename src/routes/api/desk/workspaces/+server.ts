import * as v from 'valibot';
import type { WorkspaceLayoutJson } from '#lib/server/db/schema/desk/workspace.ts';
import { createWorkspace } from '#lib/server/desk/index.ts';
import { CreateWorkspaceSchema } from '#lib/server/desk/schemas.ts';
import { guardApiUser } from '#lib/server/http/guards.ts';
import { createLimiter, rateLimitResponse } from '#lib/server/http/rate-limit.ts';
import { apiCreated, apiError, apiValidationError } from '#lib/server/http/response.ts';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:desk:workspaces', 10, '1 m');

/** Create a new workspace from current layout. Auto-activates. */
export const POST: RequestHandler = async ({ locals, request }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(CreateWorkspaceSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	const workspace = await createWorkspace(user.id, {
		name: parsed.output.name,
		layout: parsed.output.layout as unknown as WorkspaceLayoutJson,
		sortOrder: parsed.output.sortOrder,
	});

	if (!workspace) {
		return apiError(400, 'workspace_limit', 'Maximum 9 workspaces allowed.');
	}

	return apiCreated({
		id: workspace.id,
		name: workspace.name,
		sortOrder: workspace.sortOrder,
		createdAt: workspace.createdAt.toISOString(),
		updatedAt: workspace.updatedAt.toISOString(),
	});
};
