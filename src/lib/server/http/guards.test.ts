import { afterEach, describe, expect, it, vi } from 'vitest';

// ADMIN_USER_ID is controlled per test; every other variable reads process.env.
const admin = vi.hoisted(() => ({ id: undefined as string | undefined }));

vi.mock('$app/env/private', async () =>
	(await import('#lib/server/test/env-mock.ts')).envModule((name) =>
		name === 'ADMIN_USER_ID' ? admin.id : process.env[name],
	),
);

afterEach(() => {
	admin.id = undefined;
});

const guards = await import('./guards');
const {
	requireAuth,
	requireAdmin,
	guardApiUser,
	guardApiBlogAuthor,
	guardApiAdmin,
	guardPostOwnership,
	guardAssetOwnership,
} = guards;

const ADMIN_ID = 'usr_admin';

function makeLocals(user?: object, session?: object, grants: string[] = []): App.Locals {
	return { user, session, grants } as unknown as App.Locals;
}

describe('requireAuth', () => {
	it('returns { user, session } when present', () => {
		const user = { id: 'u1', email: 'test@test.com' };
		const session = { id: 's1' };
		const result = requireAuth(makeLocals(user, session));
		expect(result.user).toBe(user);
		expect(result.session).toBe(session);
	});

	it('throws redirect(303) when user is missing', () => {
		expect(() => requireAuth(makeLocals())).toThrow();
		try {
			requireAuth(makeLocals());
		} catch (e: unknown) {
			const err = e as { status: number; location: string };
			expect(err.status).toBe(303);
			expect(err.location).toBe('/auth/login');
		}
	});
});

/**
 * THE CHECK THAT WOULD HAVE CAUGHT THE 500 BUG.
 *
 * The old API guards did `throw apiError(...)`, which throws a bare `Response`.
 * SvelteKit only unwraps `HttpError` / `Redirect`, so those endpoints answered
 * 500 instead of 401/403 — and the previous test could not tell, because it
 * asserted only `.status`, which a `Response` also has.
 *
 * Page guards may throw (Kit's own error/redirect objects); API guards must
 * never throw at all. Both halves are asserted here.
 */
describe('guard throw discipline', () => {
	it('page guards throw Kit error objects, never a Response', () => {
		admin.id = ADMIN_ID;
		const cases: Array<() => unknown> = [
			() => requireAuth(makeLocals()),
			() => requireAdmin(makeLocals({ id: 'u1', email: 'x@y.z' }, { id: 's1' })),
		];
		for (const run of cases) {
			let caught: unknown;
			try {
				run();
			} catch (e) {
				caught = e;
			}
			expect(caught).toBeDefined();
			expect(caught).not.toBeInstanceOf(Response);
			expect(typeof (caught as { status?: number }).status).toBe('number');
		}
	});

	it('API guards return a Response and never throw', () => {
		admin.id = ADMIN_ID;
		const cases: Array<() => unknown> = [
			() => guardApiUser(makeLocals()),
			() => guardApiBlogAuthor(makeLocals()),
			() => guardApiAdmin(makeLocals()),
			() => guardPostOwnership(null, { id: 'u1', email: 'x@y.z' }),
			() => guardAssetOwnership(null, { id: 'u1', email: 'x@y.z' }),
		];
		for (const run of cases) {
			expect(run).not.toThrow();
			const result = run() as { error?: Response };
			expect(result.error).toBeInstanceOf(Response);
		}
	});
});

describe('requireAdmin', () => {
	it('passes when the user id is in ADMIN_USER_ID', () => {
		admin.id = ADMIN_ID;
		const user = { id: ADMIN_ID, email: 'admin@test.com' };
		const session = { id: 's1' };
		const result = requireAdmin(makeLocals(user, session));
		expect(result.user).toBe(user);
	});

	it('throws error(404) for non-admin (hides route existence)', () => {
		admin.id = ADMIN_ID;
		const user = { id: 'u1', email: 'other@test.com' };
		const session = { id: 's1' };

		expect(() => requireAdmin(makeLocals(user, session))).toThrow();
		try {
			requireAdmin(makeLocals(user, session));
		} catch (e: unknown) {
			expect((e as { status: number }).status).toBe(404);
		}
	});

	it('throws error(404) when ADMIN_USER_ID is not set', () => {
		admin.id = undefined;
		const user = { id: 'u1', email: 'any@test.com' };
		const session = { id: 's1' };

		expect(() => requireAdmin(makeLocals(user, session))).toThrow();
		try {
			requireAdmin(makeLocals(user, session));
		} catch (e: unknown) {
			expect((e as { status: number }).status).toBe(404);
		}
	});
});

describe('admin gate — ADMIN_USER_ID comma-separated list', () => {
	const session = { id: 's1' };
	function expectDenied(user: object) {
		expect(() => requireAdmin(makeLocals(user, session))).toThrow();
		try {
			requireAdmin(makeLocals(user, session));
		} catch (e: unknown) {
			expect((e as { status: number }).status).toBe(404);
		}
	}

	it('grants when the id is one of several entries', () => {
		admin.id = 'usr_one,usr_two,usr_three';
		const user = { id: 'usr_two', email: 'whatever@example.com' };
		expect(requireAdmin(makeLocals(user, session)).user).toBe(user);
	});

	it('denies when the id matches no entry', () => {
		admin.id = 'usr_one,usr_two';
		expectDenied({ id: 'usr_nope', email: 'whatever@example.com' });
	});

	it('admin cannot be transferred by re-claiming an email (id is the only key)', () => {
		// Attacker holds a plausible admin email but a different immutable id.
		admin.id = 'usr_real_admin';
		expectDenied({ id: 'usr_attacker', email: 'admin@test.com' });
	});
});

describe('isAdmin (exported helper)', () => {
	it('returns false for a null or undefined user', () => {
		admin.id = 'usr_one';
		expect(guards.isAdmin(null)).toBe(false);
		expect(guards.isAdmin(undefined)).toBe(false);
	});

	it('grants a matching user through the exported helper', () => {
		admin.id = 'usr_one,usr_two';
		expect(guards.isAdmin({ id: 'usr_two' })).toBe(true);
	});
});

describe('guardPostOwnership', () => {
	const user = { id: 'u1', email: 'user@test.com' };

	it('returns the narrowed post when the user owns it', () => {
		const post = { authorId: 'u1', title: 'mine' };
		const result = guardPostOwnership(post, user);
		expect('error' in result).toBe(false);
		if (!('error' in result)) {
			// The generic hands back the SAME object, so callers keep every field.
			expect(result.post).toBe(post);
			expect(result.post.title).toBe('mine');
		}
	});

	it('returns the post for an admin who does not own it', () => {
		admin.id = ADMIN_ID;
		const post = { authorId: 'other' };
		const result = guardPostOwnership(post, { id: ADMIN_ID, email: 'admin@test.com' });
		expect('error' in result).toBe(false);
	});

	// "Not yours" and "doesn't exist" answer identically on purpose: a 403 would
	// confirm the row exists to someone who is not allowed to see it. This
	// matches the [id] routes, which push user.id into the WHERE clause and so
	// cannot distinguish the two cases either.
	it('gives a non-owner the same 404 as a missing post', () => {
		admin.id = ADMIN_ID;
		const missing = guardPostOwnership(null, user);
		const foreign = guardPostOwnership({ authorId: 'other' }, user);

		expect('error' in missing && missing.error.status).toBe(404);
		expect('error' in foreign && foreign.error.status).toBe(404);
	});

	it('treats undefined like null', () => {
		const result = guardPostOwnership(undefined, user);
		expect('error' in result && result.error.status).toBe(404);
	});
});

describe('guardAssetOwnership', () => {
	const user = { id: 'u1', email: 'user@test.com' };

	it('returns the narrowed asset when the user owns it', () => {
		const asset = { uploaderId: 'u1', storageKey: 'blog/x.png' };
		const result = guardAssetOwnership(asset, user);
		expect('error' in result).toBe(false);
		if (!('error' in result)) {
			expect(result.asset.storageKey).toBe('blog/x.png');
		}
	});

	it('returns the asset for an admin who did not upload it', () => {
		admin.id = ADMIN_ID;
		const result = guardAssetOwnership({ uploaderId: 'other' }, { id: ADMIN_ID, email: 'admin@test.com' });
		expect('error' in result).toBe(false);
	});

	it('gives a non-uploader the same 404 as a missing asset', () => {
		admin.id = ADMIN_ID;
		const missing = guardAssetOwnership(null, user);
		const foreign = guardAssetOwnership({ uploaderId: 'other' }, user);

		expect('error' in missing && missing.error.status).toBe(404);
		expect('error' in foreign && foreign.error.status).toBe(404);
	});

	// An orphaned asset (uploader deleted → uploaderId SET NULL) belongs to
	// nobody, so no non-admin may claim it.
	it('denies a null uploaderId to a non-admin', () => {
		admin.id = ADMIN_ID;
		const result = guardAssetOwnership({ uploaderId: null }, user);
		expect('error' in result && result.error.status).toBe(404);
	});
});
describe('guardApiUser', () => {
	it('returns user/session when authenticated', () => {
		const user = { id: 'u1', email: 'test@test.com' };
		const session = { id: 's1' };
		const result = guardApiUser(makeLocals(user, session));
		expect('error' in result).toBe(false);
		if (!('error' in result)) {
			expect(result.user).toBe(user);
			expect(result.session).toBe(session);
		}
	});

	it('returns error Response(401) when unauthenticated', () => {
		const result = guardApiUser(makeLocals());
		expect('error' in result).toBe(true);
		if ('error' in result) {
			expect(result.error).toBeInstanceOf(Response);
			expect(result.error.status).toBe(401);
		}
	});
});

describe('guardApiBlogAuthor', () => {
	it('returns user/session for user with blog-author grant', () => {
		admin.id = ADMIN_ID;
		const user = { id: 'u1', email: 'author@test.com' };
		const session = { id: 's1' };
		const result = guardApiBlogAuthor(makeLocals(user, session, ['blog-author']));
		expect('error' in result).toBe(false);
		if (!('error' in result)) {
			expect(result.user).toBe(user);
		}
	});

	it('returns user/session for admin regardless of grants', () => {
		admin.id = ADMIN_ID;
		const user = { id: ADMIN_ID, email: 'admin@test.com' };
		const session = { id: 's1' };
		const result = guardApiBlogAuthor(makeLocals(user, session, []));
		expect('error' in result).toBe(false);
	});

	it('returns error Response(401) when unauthenticated', () => {
		const result = guardApiBlogAuthor(makeLocals());
		expect('error' in result).toBe(true);
		if ('error' in result) {
			expect(result.error.status).toBe(401);
		}
	});

	it('returns error Response(403) for signed-in user without grant', () => {
		admin.id = ADMIN_ID;
		const user = { id: 'u1', email: 'user@test.com' };
		const session = { id: 's1' };
		const result = guardApiBlogAuthor(makeLocals(user, session, []));
		expect('error' in result).toBe(true);
		if ('error' in result) {
			expect(result.error.status).toBe(403);
		}
	});
});

describe('readsGrants — the sessionPopulate grant lookup predicate', () => {
	it('loads grants for the blog authoring API', () => {
		expect(guards.readsGrants('/api/blog/posts')).toBe(true);
		expect(guards.readsGrants('/api/blog/assets/ast_1/image')).toBe(true);
	});

	it('skips pages and every other API', () => {
		for (const path of ['/blog', '/blog/my-post', '/de/blog', '/desk', '/de/desk/__data.json', '/api/desk/files']) {
			expect(guards.readsGrants(path), path).toBe(false);
		}
	});

	// The predicate is only correct while it covers every reader. A grant check added
	// anywhere else would see an empty array and deny a real author — silently, since the
	// admin bypass hides it from whoever tests it as admin.
	it('covers every reader of locals.grants', async () => {
		const { readdirSync, readFileSync, statSync } = await import('node:fs');
		const { join, relative } = await import('node:path');
		const root = process.cwd();
		const files: string[] = [];
		const walk = (dir: string) => {
			for (const entry of readdirSync(dir)) {
				const path = join(dir, entry);
				if (statSync(path).isDirectory()) walk(path);
				else if (/\.ts$/.test(path) && !/\.test\.ts$/.test(path)) files.push(relative(root, path));
			}
		};
		walk(join(root, 'src/routes'));
		walk(join(root, 'src/lib'));

		const outside: string[] = [];
		for (const file of files) {
			// Comments may name the field; only code reads it.
			const source = readFileSync(join(root, file), 'utf8')
				.replace(/\/\*[\s\S]*?\*\//g, '')
				.replace(/^\s*\/\/.*$/gm, '');
			const callsGuard = /import\s*(?:type\s*)?\{[^}]*\bguardApiBlogAuthor\b[^}]*\}/.test(source);
			const readsLocals = /locals\.grants/.test(source) && file !== 'src/lib/server/http/guards.ts';
			const route = `/${file.replace(/^src\/routes\//, '')}`;
			if (callsGuard && !(file.startsWith('src/routes/') && guards.readsGrants(route))) outside.push(file);
			if (readsLocals) outside.push(file);
		}
		expect(outside, 'grant readers outside readsGrants — widen the predicate').toEqual([]);
	});
});
