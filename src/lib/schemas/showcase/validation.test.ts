import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { asyncSchema, realtimeSchema, serverSchema } from './validation';

describe('realtimeSchema', () => {
	const valid = {
		username: 'test_user',
		password: 'Str0ng!Pass',
		confirmPassword: 'Str0ng!Pass',
	};

	it('accepts valid input', () => {
		const result = v.safeParse(realtimeSchema, valid);
		expect(result.success).toBe(true);
	});

	it('requires uppercase letter in password', () => {
		const result = v.safeParse(realtimeSchema, {
			...valid,
			password: 'str0ng!pass',
			confirmPassword: 'str0ng!pass',
		});
		expect(result.success).toBe(false);
	});

	it('requires number in password', () => {
		const result = v.safeParse(realtimeSchema, {
			...valid,
			password: 'Strong!Pass',
			confirmPassword: 'Strong!Pass',
		});
		expect(result.success).toBe(false);
	});

	it('requires special character in password', () => {
		const result = v.safeParse(realtimeSchema, {
			...valid,
			password: 'Str0ngPass1',
			confirmPassword: 'Str0ngPass1',
		});
		expect(result.success).toBe(false);
	});

	it('rejects mismatched confirmPassword (cross-field via v.forward)', () => {
		const result = v.safeParse(realtimeSchema, {
			...valid,
			confirmPassword: 'Different!1',
		});
		expect(result.success).toBe(false);
	});

	it('rejects username with uppercase letters', () => {
		const result = v.safeParse(realtimeSchema, {
			...valid,
			username: 'Test_User',
		});
		expect(result.success).toBe(false);
	});
});

describe('asyncSchema', () => {
	it('accepts valid input', () => {
		const result = v.safeParse(asyncSchema, {
			username: 'testuser',
			email: 'Test@Example.COM',
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.output.email).toBe('test@example.com');
		}
	});

	it('trims and lowercases email', () => {
		const result = v.safeParse(asyncSchema, {
			username: 'testuser',
			email: '  User@Test.Com  ',
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.output.email).toBe('user@test.com');
		}
	});

	it('rejects invalid email', () => {
		const result = v.safeParse(asyncSchema, {
			username: 'testuser',
			email: 'not-an-email',
		});
		expect(result.success).toBe(false);
	});
});

describe('serverSchema', () => {
	it('accepts valid input', () => {
		const result = v.safeParse(serverSchema, {
			email: 'user@test.com',
			inviteCode: 'ABCD',
		});
		expect(result.success).toBe(true);
	});

	it('rejects inviteCode shorter than 4 chars', () => {
		const result = v.safeParse(serverSchema, {
			email: 'user@test.com',
			inviteCode: 'AB',
		});
		expect(result.success).toBe(false);
	});

	it('rejects empty email', () => {
		const result = v.safeParse(serverSchema, {
			email: '',
			inviteCode: 'ABCD',
		});
		expect(result.success).toBe(false);
	});

	it('trims and lowercases email', () => {
		const result = v.safeParse(serverSchema, {
			email: '  User@Test.Com  ',
			inviteCode: 'ABCDE',
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.output.email).toBe('user@test.com');
		}
	});
});
