import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { localizeHref } from '$lib/i18n';
import { apiError } from '$lib/server/api/response';

/**
 * Admin gate.
 *
 * `ADMIN_USER_ID` is a comma-separated list of admin user ids (one per admin).
 * IDs are immutable, so admin can't be transferred by re-claiming an email.
 * Bootstrap a fresh install by signing in once (any OAuth method creates the
 * user row), then copy that row's id (auth."user".id) into ADMIN_USER_ID.
 *
 * Exported so the root layout drives admin-nav visibility from the same source
 * of truth as the route guards — no divergent second check.
 */
function splitEnvList(raw: string | undefined): string[] {
	return (
		raw
			?.split(',')
			.map((s) => s.trim())
			.filter(Boolean) ?? []
	);
}

export function isAdmin(user: { id: string } | null | undefined): boolean {
	if (!user) return false;
	// IDs are case-sensitive opaque tokens — compare exactly (trim only).
	return splitEnvList(env.ADMIN_USER_ID).includes(user.id);
}

export function requireAuth(locals: App.Locals, returnTo?: string) {
	if (!locals.user || !locals.session) {
		const target = returnTo ? `/auth/login?returnTo=${encodeURIComponent(returnTo)}` : '/auth/login';
		redirect(303, localizeHref(target));
	}
	return { user: locals.user, session: locals.session };
}

/** For API routes — throws apiError(401) for consistent { error: { code, message } } shape. */
export function requireApiUser(locals: App.Locals) {
	if (!locals.user || !locals.session) {
		throw apiError(401, 'unauthorized', 'Authentication required');
	}
	return { user: locals.user, session: locals.session };
}

export function requireAdmin(locals: App.Locals, returnTo?: string) {
	const { user, session } = requireAuth(locals, returnTo);
	if (!isAdmin(user)) error(404, 'Not Found');
	return { user, session };
}

function hasBlogAuthorGrant(locals: App.Locals): boolean {
	return locals.grants?.includes('blog-author') ?? false;
}

/** Requires admin or blog-author grant. Redirects to login if unauthenticated. */
export function requireBlogAuthor(locals: App.Locals) {
	const { user, session } = requireAuth(locals);
	if (!isAdmin(user) && !hasBlogAuthorGrant(locals)) error(403, 'Forbidden');
	return { user, session };
}

/** For API routes — throws apiError(403) for consistent { error: { code, message } } shape. */
export function requireApiBlogAuthor(locals: App.Locals) {
	const { user, session } = requireApiUser(locals);
	if (!isAdmin(user) && !hasBlogAuthorGrant(locals)) {
		throw apiError(403, 'forbidden_no_grant', 'Insufficient permissions');
	}
	return { user, session };
}

/** Verify the authenticated user owns the post (or is admin). */
export function requirePostOwnership(
	post: { authorId: string } | null,
	user: { id: string; email: string },
): asserts post is { authorId: string } {
	if (!post) throw apiError(404, 'not_found', 'Post not found');
	if (post.authorId !== user.id && !isAdmin(user)) {
		throw apiError(403, 'forbidden', 'Forbidden');
	}
}

/** Verify the authenticated user owns the asset (or is admin). */
export function requireAssetOwnership(
	asset: { uploaderId: string | null } | null,
	user: { id: string; email: string },
): asserts asset is { uploaderId: string | null } {
	if (!asset) throw apiError(404, 'not_found', 'Asset not found');
	if (asset.uploaderId !== user.id && !isAdmin(user)) {
		throw apiError(403, 'forbidden', 'Forbidden');
	}
}

// ---------------------------------------------------------------------------
// API-safe guards — return Response objects instead of throwing HttpError.
// Use these in +server.ts endpoints for consistent { error: { code, message } } shape.
// ---------------------------------------------------------------------------

type ApiGuardSuccess = { user: App.Locals['user'] & {}; session: App.Locals['session'] & {} };
type ApiGuardResult = ApiGuardSuccess | { error: Response };

/** Like requireApiUser but returns apiError(401) instead of throwing. */
export function guardApiUser(locals: App.Locals): ApiGuardResult {
	if (!locals.user || !locals.session) {
		return { error: apiError(401, 'unauthorized', 'Authentication required') };
	}
	return { user: locals.user, session: locals.session };
}

/** Like requireApiBlogAuthor but returns apiError instead of throwing. */
export function guardApiBlogAuthor(locals: App.Locals): ApiGuardResult {
	if (!locals.user || !locals.session) {
		return { error: apiError(401, 'unauthorized', 'Authentication required') };
	}
	if (!isAdmin(locals.user) && !hasBlogAuthorGrant(locals)) {
		return { error: apiError(403, 'forbidden_no_grant', 'Insufficient permissions') };
	}
	return { user: locals.user, session: locals.session };
}

/** Like requireAdmin but returns apiError instead of throwing. */
export function guardApiAdmin(locals: App.Locals): ApiGuardResult {
	if (!locals.user || !locals.session) {
		return { error: apiError(401, 'unauthorized', 'Authentication required') };
	}
	if (!isAdmin(locals.user)) {
		return { error: apiError(403, 'forbidden', 'Admin only') };
	}
	return { user: locals.user, session: locals.session };
}
