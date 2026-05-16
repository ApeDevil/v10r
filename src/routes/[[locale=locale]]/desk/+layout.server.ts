import { getDeskTheme, listDeskPresets } from '$lib/server/db/desk/theme-queries';
import { getActiveWorkspaceId, listWorkspaces } from '$lib/server/db/desk/workspace-queries';
import type { LayoutServerLoad } from './$types';

/**
 * Governor config shape prefetched for the desk session.
 *
 * Feeds both the pre-stream policy resolution (`resolveEffectivePolicy`
 * in `policy/governor.ts`) and the bot-config UI — the UI ceiling
 * matches the server ceiling so users can't toggle on a scope the
 * server will later reject.
 *
 * Stub today: every user gets full scopes and unlimited budget. Adopting
 * projects wire this to their own role/subscription logic — the seam
 * is visible, the policy isn't prescribed.
 */
export interface DeskGovernorConfig {
	permittedScopes: Array<'desk:read' | 'desk:write' | 'desk:create' | 'desk:delete'>;
	riskTier: 'low' | 'medium' | 'high';
	dailyToolBudget: number | null;
}

function resolveGovernorConfig(_userId: string): DeskGovernorConfig {
	return {
		permittedScopes: ['desk:read', 'desk:write', 'desk:create', 'desk:delete'],
		riskTier: 'medium',
		dailyToolBudget: null,
	};
}

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return {
			deskTheme: null,
			deskPresets: [],
			deskWorkspaces: [],
			deskActiveWorkspaceId: null,
			governorConfig: null,
		};
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
		governorConfig: resolveGovernorConfig(locals.user.id),
	};
};
