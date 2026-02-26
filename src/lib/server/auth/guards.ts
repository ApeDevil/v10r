import { redirect, error } from '@sveltejs/kit';
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
	if (!adminEmail || user.email !== adminEmail) {
		error(403, 'Forbidden');
	}
	return { user, session };
}
