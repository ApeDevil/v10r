/**
 * Canonical projection of an authenticated user for the server→client boundary.
 *
 * A `load` return value is serialized into the HTML and the client `data` object,
 * so returning `locals.user` wholesale ships internal Better Auth augmentation
 * (`role`, `banned`, `banReason`, timestamps) to the browser. Every load that needs
 * to expose the viewer's identity MUST return `publicUser(locals.user)` instead of
 * the raw object. Enforced by the load-leak-gate test.
 */
export interface PublicUser {
	id: string;
	email: string;
	name: string;
	image: string | null;
	emailVerified: boolean;
}

export function publicUser(user: NonNullable<App.Locals['user']>): PublicUser {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		image: user.image ?? null,
		emailVerified: user.emailVerified,
	};
}
