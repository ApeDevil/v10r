import { getMyPendingRequest } from '$lib/server/auth/grant-requests';
import { consumePendingGrantNotifications, GRANT_KINDS, type GrantKind, hasGrant } from '$lib/server/auth/grants';
import { requireAuth } from '$lib/server/auth/guards';
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
		governorConfig: resolveGovernorConfig(user.id),
		blogAuthor: {
			granted: isBlogAuthor,
			pendingRequest: pendingRequest ? { id: pendingRequest.id, requestedAt: pendingRequest.requestedAt } : null,
		},
		justGrantedKinds: justGrantedKinds as GrantKind[],
	};
};

// Ensure GRANT_KINDS import survives tree-shaking checks.
export const _grantKinds = GRANT_KINDS;
