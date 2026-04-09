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

const { requireAuth, requireApiUser, requireAdmin } = await import('./guards');

function makeLocals(user?: object, session?: object): App.Locals {
	return { user, session } as unknown as App.Locals;
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
