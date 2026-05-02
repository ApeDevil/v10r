import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { localizeHref } from '$lib/i18n';
import { apiError } from '$lib/server/api/response';

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
	const adminEmail = env.ADMIN_EMAIL;
	if (!adminEmail || user.email.toLowerCase() !== adminEmail.toLowerCase()) {
		error(404, 'Not Found');
	}
	return { user, session };
}

/** Requires admin or author role. Redirects to login if unauthenticated. */
export function requireAuthor(locals: App.Locals) {
	const { user, session } = requireAuth(locals);
	const adminEmail = env.ADMIN_EMAIL;
	const isAdmin = adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase();
	if (!isAdmin && user.role !== 'author') {
		error(403, 'Forbidden');
	}
	return { user, session };
}

/** For API routes — throws apiError(403) for consistent { error: { code, message } } shape. */
export function requireApiAuthor(locals: App.Locals) {
	const { user, session } = requireApiUser(locals);
	const adminEmail = env.ADMIN_EMAIL;
	const isAdmin = adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase();
	if (!isAdmin && user.role !== 'author') {
		throw apiError(403, 'forbidden', 'Insufficient permissions');
	}
	return { user, session };
}

/** Verify the authenticated user owns the post (or is admin). */
export function requirePostOwnership(
	post: { authorId: string } | null,
	user: { id: string; email: string },
): asserts post is { authorId: string } {
	if (!post) throw apiError(404, 'not_found', 'Post not found');
	const adminEmail = env.ADMIN_EMAIL;
	const isAdmin = adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase();
	if (post.authorId !== user.id && !isAdmin) {
		throw apiError(403, 'forbidden', 'Forbidden');
	}
}

/** Verify the authenticated user owns the asset (or is admin). */
export function requireAssetOwnership(
	asset: { uploaderId: string | null } | null,
	user: { id: string; email: string },
): asserts asset is { uploaderId: string | null } {
	if (!asset) throw apiError(404, 'not_found', 'Asset not found');
	const adminEmail = env.ADMIN_EMAIL;
	const isAdmin = adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase();
	if (asset.uploaderId !== user.id && !isAdmin) {
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

/** Like requireApiAuthor but returns apiError instead of throwing. */
export function guardApiAuthor(locals: App.Locals): ApiGuardResult {
	if (!locals.user || !locals.session) {
		return { error: apiError(401, 'unauthorized', 'Authentication required') };
	}
	const adminEmail = env.ADMIN_EMAIL;
	const isAdmin = adminEmail && locals.user.email.toLowerCase() === adminEmail.toLowerCase();
	if (!isAdmin && locals.user.role !== 'author') {
		return { error: apiError(403, 'forbidden', 'Insufficient permissions') };
	}
	return { user: locals.user, session: locals.session };
}
