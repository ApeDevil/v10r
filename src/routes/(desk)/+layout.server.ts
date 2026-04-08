import type { LayoutServerLoad } from './$types';
import { getDeskTheme, listDeskPresets } from '$lib/server/db/desk/theme-queries';
import { listWorkspaces, getActiveWorkspaceId } from '$lib/server/db/desk/workspace-queries';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { deskTheme: null, deskPresets: [], deskWorkspaces: [], deskActiveWorkspaceId: null };
	}

	const [theme, presets, workspaces, activeWorkspaceId] = await Promise.all([
		getDeskTheme(locals.user.id),
		listDeskPresets(locals.user.id),
		listWorkspaces(locals.user.id),
		getActiveWorkspaceId(locals.user.id),
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
	};
};
