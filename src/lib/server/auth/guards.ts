import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export function requireAuth(locals: App.Locals) {
	if (!locals.user || !locals.session) {
		redirect(303, '/auth/login');
	}
	return { user: locals.user, session: locals.session };
}

/** For API routes — throws 401 instead of redirecting. */
export function requireApiUser(locals: App.Locals) {
	if (!locals.user || !locals.session) {
		error(401, 'Authentication required');
	}
	return { user: locals.user, session: locals.session };
}

export function requireAdmin(locals: App.Locals) {
	const { user, session } = requireAuth(locals);
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

/** For API routes — throws 403 instead of redirecting. */
export function requireApiAuthor(locals: App.Locals) {
	const { user, session } = requireApiUser(locals);
	const adminEmail = env.ADMIN_EMAIL;
	const isAdmin = adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase();
	if (!isAdmin && user.role !== 'author') {
		error(403, 'Forbidden');
	}
	return { user, session };
}

/** Verify the authenticated user owns the post (or is admin). */
export function requirePostOwnership(
	post: { authorId: string } | null,
	user: { id: string; email: string },
): asserts post is { authorId: string } {
	if (!post) error(404, 'Post not found');
	const adminEmail = env.ADMIN_EMAIL;
	const isAdmin = adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase();
	if (post.authorId !== user.id && !isAdmin) {
		error(403, 'Forbidden');
	}
}

/** Verify the authenticated user owns the asset (or is admin). */
export function requireAssetOwnership(
	asset: { uploaderId: string | null } | null,
	user: { id: string; email: string },
): asserts asset is { uploaderId: string | null } {
	if (!asset) error(404, 'Asset not found');
	const adminEmail = env.ADMIN_EMAIL;
	const isAdmin = adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase();
	if (asset.uploaderId !== user.id && !isAdmin) {
		error(403, 'Forbidden');
	}
}
