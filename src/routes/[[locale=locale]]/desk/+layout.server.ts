import { getMyPendingRequest } from '$lib/server/auth/grant-requests';
import { consumePendingGrantNotifications, type GrantKind, hasGrant } from '$lib/server/auth/grants';
import { getDeskTheme, listDeskPresets } from '$lib/server/db/desk/theme-queries';
import { getActiveWorkspaceId, listWorkspaces } from '$lib/server/db/desk/workspace-queries';
import { requireAuth } from '$lib/server/http/guards';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const { user } = requireAuth(locals, url.pathname);

	const [theme, presets, workspaces, activeWorkspaceId, isBlogAuthor, pendingRequest, justGrantedKinds] =
		await Promise.all([
			getDeskTheme(user.id),
			listDeskPresets(user.id),
			listWorkspaces(user.id),
			getActiveWorkspaceId(user.id),
			hasGrant(user.id, 'blog-author'),
			getMyPendingRequest(user.id, 'blog-author'),
			consumePendingGrantNotifications(user.id),
		]);

	return {
		deskTheme: theme
			? {
					workspace: theme.workspace,
					typeStyles: theme.typeStyles,
					activePresetId: theme.activePresetId,
				}
			: null,
		deskPresets: presets.map((p) => ({
			id: p.id,
			name: p.name,
			workspace: p.workspace,
			typeStyles: p.typeStyles,
		})),
		deskWorkspaces: workspaces.map((w) => ({
			id: w.id,
			name: w.name,
			layout: w.layout,
			sortOrder: w.sortOrder,
			createdAt: w.createdAt.toISOString(),
			updatedAt: w.updatedAt.toISOString(),
		})),
		deskActiveWorkspaceId: activeWorkspaceId,
		blogAuthor: {
			granted: isBlogAuthor,
			pendingRequest: pendingRequest ? { id: pendingRequest.id, requestedAt: pendingRequest.requestedAt } : null,
		},
		justGrantedKinds: justGrantedKinds as GrantKind[],
	};
};
