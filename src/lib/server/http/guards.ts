import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { localizeHref } from '$lib/i18n';
import { parseAdminIds } from '$lib/server/auth/admin-ids';
import { apiError } from '$lib/server/http/response';

/**
 * Admin gate. `ADMIN_USER_ID` semantics + parsing live in `./admin-ids` (single source of
 * truth, shared with the framework-free AI orchestrator). Exported so the root layout drives
 * admin-nav visibility from the same check as the route guards — no divergent second copy.
 */
export function isAdmin(user: { id: string } | null | undefined): boolean {
	if (!user) return false;
	// IDs are case-sensitive opaque tokens — compare exactly (parseAdminIds trims only).
	return parseAdminIds(env.ADMIN_USER_ID).includes(user.id);
}

export function requireAuth(locals: App.Locals, returnTo?: string) {
	if (!locals.user || !locals.session) {
		const target = returnTo ? `/auth/login?returnTo=${encodeURIComponent(returnTo)}` : '/auth/login';
		redirect(303, localizeHref(target));
	}
	return { user: locals.user, session: locals.session };
}

/**
 * `+server.ts` uses the RETURNING `guardApi*` family below. Throwing `apiError`
 * here would throw a bare `Response`, which SvelteKit does not special-case the
 * way it does `HttpError` / `Redirect` — it falls through to `handle_fatal_error`
 * and answers 500 instead of 401/403, invisibly, because a `Response` also has a
 * `.status`. `guard-contract.gate.test.ts` enforces this. Page loads keep
 * `requireAuth` / `requireAdmin`, which use Kit's own `redirect()` / `error()`.
 */

export function requireAdmin(locals: App.Locals, returnTo?: string) {
	const { user, session } = requireAuth(locals, returnTo);
	if (!isAdmin(user)) error(404, 'Not Found');
	return { user, session };
}

function hasBlogAuthorGrant(locals: App.Locals): boolean {
	return locals.grants?.includes('blog-author') ?? false;
}

// API guards — the ONLY family `+server.ts` may use.
//
// They return a Response rather than throwing one: SvelteKit does not unwrap a
// thrown Response, so `throw apiError(...)` becomes a 500. Callers discriminate
// with `'error' in guard`, which is why the success branch always carries a
// distinct required key (no `?: never` — optional-never keys make `in`-narrowing
// unreliable).

type ApiGuardSuccess = { user: App.Locals['user'] & {}; session: App.Locals['session'] & {} };
type ApiGuardResult = ApiGuardSuccess | { error: Response };

/** Requires a signed-in user. Returns apiError(401) otherwise. */
export function guardApiUser(locals: App.Locals): ApiGuardResult {
	if (!locals.user || !locals.session) {
		return { error: apiError(401, 'unauthorized', 'Authentication required') };
	}
	return { user: locals.user, session: locals.session };
}

/** Requires admin or the blog-author grant. Returns apiError(401/403) otherwise. */
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

// Ownership guards.
//
// These replace assertion functions (`asserts post is ...`). The generic is
// load-bearing: the old signature narrowed `Post | null` to `Post` by filtering
// the union, so callers went straight on to `post.domainId`. Returning `T`
// hands that same narrowed value back under a required key, and the caller
// re-binds it — so every downstream field access typechecks unchanged.
//
// "Not yours" and "doesn't exist" both answer 404 on purpose: a 403 would
// confirm the row exists to someone who cannot see it.

/** Verify the authenticated user owns the post (or is admin). */
export function guardPostOwnership<T extends { authorId: string }>(
	post: T | null | undefined,
	user: { id: string; email: string },
): { error: Response } | { post: T } {
	if (!post) return { error: apiError(404, 'not_found', 'Post not found') };
	if (post.authorId !== user.id && !isAdmin(user)) {
		return { error: apiError(404, 'not_found', 'Post not found') };
	}
	return { post };
}

/** Verify the authenticated user owns the asset (or is admin). */
export function guardAssetOwnership<T extends { uploaderId: string | null }>(
	asset: T | null | undefined,
	user: { id: string; email: string },
): { error: Response } | { asset: T } {
	if (!asset) return { error: apiError(404, 'not_found', 'Asset not found') };
	if (asset.uploaderId !== user.id && !isAdmin(user)) {
		return { error: apiError(404, 'not_found', 'Asset not found') };
	}
	return { asset };
}
