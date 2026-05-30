import { describe, expect, it, vi } from 'vitest';

// Mock $env/dynamic/private — ADMIN_EMAIL controlled per test
let mockAdminEmail: string | undefined;

vi.mock('$env/dynamic/private', () => ({
	env: new Proxy(
		{},
		{
			get: (_target, prop: string) => {
				if (prop === 'ADMIN_EMAIL') return mockAdminEmail;
				return process.env[prop];
			},
		},
	),
}));

const guards = await import('./guards');
const {
	requireAuth,
	requireApiUser,
	requireAdmin,
	requireBlogAuthor,
	requireApiBlogAuthor,
	guardApiUser,
	guardApiBlogAuthor,
} = guards;
const requirePostOwnership: typeof guards.requirePostOwnership = guards.requirePostOwnership;
const requireAssetOwnership: typeof guards.requireAssetOwnership = guards.requireAssetOwnership;

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

describe('requireApiUser', () => {
	it('returns { user, session } when present', () => {
		const user = { id: 'u1', email: 'test@test.com' };
		const session = { id: 's1' };
		const result = requireApiUser(makeLocals(user, session));
		expect(result.user).toBe(user);
	});

	it('throws error(401) when user is missing', () => {
		expect(() => requireApiUser(makeLocals())).toThrow();
		try {
			requireApiUser(makeLocals());
		} catch (e: unknown) {
			expect((e as { status: number }).status).toBe(401);
		}
	});
});

describe('requireAdmin', () => {
	it('passes when email matches ADMIN_EMAIL', () => {
		mockAdminEmail = 'admin@test.com';
		const user = { id: 'u1', email: 'admin@test.com' };
		const session = { id: 's1' };
		const result = requireAdmin(makeLocals(user, session));
		expect(result.user).toBe(user);
	});

	it('throws error(404) for non-admin (hides route existence)', () => {
		mockAdminEmail = 'admin@test.com';
		const user = { id: 'u1', email: 'other@test.com' };
		const session = { id: 's1' };

		expect(() => requireAdmin(makeLocals(user, session))).toThrow();
		try {
			requireAdmin(makeLocals(user, session));
		} catch (e: unknown) {
			expect((e as { status: number }).status).toBe(404);
		}
	});

	it('throws error(404) when ADMIN_EMAIL is not set', () => {
		mockAdminEmail = undefined;
		const user = { id: 'u1', email: 'any@test.com' };
		const session = { id: 's1' };

		expect(() => requireAdmin(makeLocals(user, session))).toThrow();
		try {
			requireAdmin(makeLocals(user, session));
		} catch (e: unknown) {
			expect((e as { status: number }).status).toBe(404);
		}
	});

	it('is case-insensitive for email comparison', () => {
		mockAdminEmail = 'Admin@Test.com';
		const user = { id: 'u1', email: 'admin@test.com' };
		const session = { id: 's1' };
		const result = requireAdmin(makeLocals(user, session));
		expect(result.user).toBe(user);
	});
});

describe('requireBlogAuthor', () => {
	it('passes for user with blog-author grant', () => {
		mockAdminEmail = 'admin@test.com';
		const user = { id: 'u1', email: 'author@test.com' };
		const session = { id: 's1' };
		const result = requireBlogAuthor(makeLocals(user, session, ['blog-author']));
		expect(result.user).toBe(user);
	});

	it('passes for admin regardless of grants', () => {
		mockAdminEmail = 'admin@test.com';
		const user = { id: 'u1', email: 'admin@test.com' };
		const session = { id: 's1' };
		const result = requireBlogAuthor(makeLocals(user, session, []));
		expect(result.user).toBe(user);
	});

	it('throws error(403) for signed-in user without grant', () => {
		mockAdminEmail = 'admin@test.com';
		const user = { id: 'u1', email: 'user@test.com' };
		const session = { id: 's1' };

		expect(() => requireBlogAuthor(makeLocals(user, session, []))).toThrow();
		try {
			requireBlogAuthor(makeLocals(user, session, []));
		} catch (e: unknown) {
			expect((e as { status: number }).status).toBe(403);
		}
	});

	it('redirects when unauthenticated (delegates to requireAuth)', () => {
		expect(() => requireBlogAuthor(makeLocals())).toThrow();
		try {
			requireBlogAuthor(makeLocals());
		} catch (e: unknown) {
			expect((e as { status: number }).status).toBe(303);
		}
	});

	it('is case-insensitive for admin email check', () => {
		mockAdminEmail = 'Admin@Test.com';
		const user = { id: 'u1', email: 'admin@test.com' };
		const session = { id: 's1' };
		const result = requireBlogAuthor(makeLocals(user, session, []));
		expect(result.user).toBe(user);
	});
});

describe('requireApiBlogAuthor', () => {
	it('passes for user with blog-author grant', () => {
		mockAdminEmail = 'admin@test.com';
		const user = { id: 'u1', email: 'author@test.com' };
		const session = { id: 's1' };
		const result = requireApiBlogAuthor(makeLocals(user, session, ['blog-author']));
		expect(result.user).toBe(user);
	});

	it('passes for admin regardless of grants', () => {
		mockAdminEmail = 'admin@test.com';
		const user = { id: 'u1', email: 'admin@test.com' };
		const session = { id: 's1' };
		const result = requireApiBlogAuthor(makeLocals(user, session, []));
		expect(result.user).toBe(user);
	});

	it('throws apiError(403) for signed-in user without grant', () => {
		mockAdminEmail = 'admin@test.com';
		const user = { id: 'u1', email: 'user@test.com' };
		const session = { id: 's1' };

		expect(() => requireApiBlogAuthor(makeLocals(user, session, []))).toThrow();
		try {
			requireApiBlogAuthor(makeLocals(user, session, []));
		} catch (e: unknown) {
			expect((e as { status: number }).status).toBe(403);
		}
	});

	it('throws apiError(401) when unauthenticated', () => {
		expect(() => requireApiBlogAuthor(makeLocals())).toThrow();
		try {
			requireApiBlogAuthor(makeLocals());
		} catch (e: unknown) {
			expect((e as { status: number }).status).toBe(401);
		}
	});
});

describe('requirePostOwnership', () => {
	it('passes when user owns the post', () => {
		const post = { authorId: 'u1' };
		const user = { id: 'u1', email: 'user@test.com' };
		expect(() => requirePostOwnership(post, user)).not.toThrow();
	});

	it('passes for admin even if not owner', () => {
		mockAdminEmail = 'admin@test.com';
		const post = { authorId: 'other' };
		const user = { id: 'u1', email: 'admin@test.com' };
		expect(() => requirePostOwnership(post, user)).not.toThrow();
	});

	it('throws apiError(404) when post is null', () => {
		const user = { id: 'u1', email: 'user@test.com' };
		expect(() => requirePostOwnership(null, user)).toThrow();
		try {
			requirePostOwnership(null, user);
		} catch (e: unknown) {
			expect((e as { status: number }).status).toBe(404);
		}
	});

	it('throws apiError(403) when user is not owner and not admin', () => {
		mockAdminEmail = 'admin@test.com';
		const post = { authorId: 'other' };
		const user = { id: 'u1', email: 'user@test.com' };

		expect(() => requirePostOwnership(post, user)).toThrow();
		try {
			requirePostOwnership(post, user);
		} catch (e: unknown) {
			expect((e as { status: number }).status).toBe(403);
		}
	});

	it('admin check is case-insensitive', () => {
		mockAdminEmail = 'Admin@Test.com';
		const post = { authorId: 'other' };
		const user = { id: 'u1', email: 'admin@test.com' };
		expect(() => requirePostOwnership(post, user)).not.toThrow();
	});
});

describe('requireAssetOwnership', () => {
	it('passes when user owns the asset', () => {
		const asset = { uploaderId: 'u1' };
		const user = { id: 'u1', email: 'user@test.com' };
		expect(() => requireAssetOwnership(asset, user)).not.toThrow();
	});

	it('passes for admin even if not owner', () => {
		mockAdminEmail = 'admin@test.com';
		const asset = { uploaderId: 'other' };
		const user = { id: 'u1', email: 'admin@test.com' };
		expect(() => requireAssetOwnership(asset, user)).not.toThrow();
	});

	it('throws apiError(404) when asset is null', () => {
		const user = { id: 'u1', email: 'user@test.com' };
		expect(() => requireAssetOwnership(null, user)).toThrow();
		try {
			requireAssetOwnership(null, user);
		} catch (e: unknown) {
			expect((e as { status: number }).status).toBe(404);
		}
	});

	it('throws apiError(403) when user is not owner and not admin', () => {
		mockAdminEmail = 'admin@test.com';
		const asset = { uploaderId: 'other' };
		const user = { id: 'u1', email: 'user@test.com' };

		expect(() => requireAssetOwnership(asset, user)).toThrow();
		try {
			requireAssetOwnership(asset, user);
		} catch (e: unknown) {
			expect((e as { status: number }).status).toBe(403);
		}
	});

	it('handles asset with null uploaderId', () => {
		mockAdminEmail = undefined;
		const asset = { uploaderId: null };
		const user = { id: 'u1', email: 'user@test.com' };

		expect(() => requireAssetOwnership(asset, user)).toThrow();
		try {
			requireAssetOwnership(asset, user);
		} catch (e: unknown) {
			expect((e as { status: number }).status).toBe(403);
		}
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
		mockAdminEmail = 'admin@test.com';
		const user = { id: 'u1', email: 'author@test.com' };
		const session = { id: 's1' };
		const result = guardApiBlogAuthor(makeLocals(user, session, ['blog-author']));
		expect('error' in result).toBe(false);
		if (!('error' in result)) {
			expect(result.user).toBe(user);
		}
	});

	it('returns user/session for admin regardless of grants', () => {
		mockAdminEmail = 'admin@test.com';
		const user = { id: 'u1', email: 'admin@test.com' };
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
		mockAdminEmail = 'admin@test.com';
		const user = { id: 'u1', email: 'user@test.com' };
		const session = { id: 's1' };
		const result = guardApiBlogAuthor(makeLocals(user, session, []));
		expect('error' in result).toBe(true);
		if ('error' in result) {
			expect(result.error.status).toBe(403);
		}
	});
});
