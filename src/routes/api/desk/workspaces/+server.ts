import * as v from 'valibot';
import { apiCreated, apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { requireApiUser } from '$lib/server/auth/guards';
import type { WorkspaceLayoutJson } from '$lib/server/db/schema/desk/workspace';
import { createWorkspace, getActiveWorkspaceId, listWorkspaces } from '$lib/server/desk';
import { CreateWorkspaceSchema } from '$lib/server/desk/schemas';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:desk:workspaces', 10, '1 m');

/** List all workspaces (with layouts) + active ID. */
export const GET: RequestHandler = async ({ locals }) => {
	const { user } = requireApiUser(locals);

	const [workspaces, activeId] = await Promise.all([listWorkspaces(user.id), getActiveWorkspaceId(user.id)]);

	return apiOk({
		workspaces: workspaces.map((w) => ({
			id: w.id,
			name: w.name,
			layout: w.layout,
			sortOrder: w.sortOrder,
			createdAt: w.createdAt.toISOString(),
			updatedAt: w.updatedAt.toISOString(),
		})),
		activeId,
	});
};

/** Create a new workspace from current layout. Auto-activates. */
export const POST: RequestHandler = async ({ locals, request }) => {
	const { user } = requireApiUser(locals);

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
