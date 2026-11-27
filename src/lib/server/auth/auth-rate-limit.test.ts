import { describe, expect, it } from 'vitest';
import { type AuthRateLimitBucket, authRateLimitBucket } from './auth-rate-limit.ts';
import {
	CALLBACK_RATE_LIMIT_MAX,
	OAUTH_MACHINE_RATE_LIMIT_MAX,
	RATE_LIMIT_MAX,
	SIGN_IN_CEREMONY_RATE_LIMIT_MAX,
} from './config.ts';

const MAX_PER_BUCKET: Record<AuthRateLimitBucket, number> = {
	'oauth-machine': OAUTH_MACHINE_RATE_LIMIT_MAX,
	'oauth-callback': CALLBACK_RATE_LIMIT_MAX,
	'sign-in-ceremony': SIGN_IN_CEREMONY_RATE_LIMIT_MAX,
	auth: RATE_LIMIT_MAX,
};

/** Replays requests from one IP inside one window; returns the first refused path, or null. */
function firstRefused(paths: string[], bucketOf: (path: string) => AuthRateLimitBucket): string | null {
	const used = new Map<AuthRateLimitBucket, number>();
	for (const path of paths) {
		const bucket = bucketOf(path);
		const count = (used.get(bucket) ?? 0) + 1;
		if (count > MAX_PER_BUCKET[bucket]) return path;
		used.set(bucket, count);
	}
	return null;
}

const AUTHORIZE = '/api/auth/oauth2/authorize';
const PASSKEY_OPTIONS = '/api/auth/passkey/generate-authenticate-options';
const PASSKEY_VERIFY = '/api/auth/passkey/verify-authentication';

/**
 * The /api/auth requests one phone made on 2026-11-27 (Vercel request log, 07:41 UTC): an MCP
 * host's authorization link (3×), the login page's passkey challenge (autofill + button), then
 * the passkey verification that came back 429. Followed by what a successful sign-in still
 * needs: re-entering the authorization endpoint.
 */
const MCP_CONNECT_THEN_PASSKEY = [
	AUTHORIZE,
	AUTHORIZE,
	AUTHORIZE,
	PASSKEY_OPTIONS,
	PASSKEY_OPTIONS,
	PASSKEY_VERIFY,
	AUTHORIZE,
];

describe('authRateLimitBucket', () => {
	it('reproduces the lockout when every auth request shares the strict bucket', () => {
		expect(firstRefused(MCP_CONNECT_THEN_PASSKEY, () => 'auth')).toBe(PASSKEY_VERIFY);
	});

	it('lets an MCP connect followed by one passkey sign-in through', () => {
		expect(firstRefused(MCP_CONNECT_THEN_PASSKEY, authRateLimitBucket)).toBeNull();
	});

	it('lets an MCP connect followed by an email code sign-in through', () => {
		const paths = [
			AUTHORIZE,
			AUTHORIZE,
			AUTHORIZE,
			PASSKEY_OPTIONS,
			'/api/auth/email-otp/send-verification-otp',
			'/api/auth/sign-in/email-otp',
			AUTHORIZE,
		];
		expect(firstRefused(paths, authRateLimitBucket)).toBeNull();
	});

	it('keeps credential checks and email sends on the strict bucket', () => {
		for (const path of [
			PASSKEY_VERIFY,
			'/api/auth/sign-in/email-otp',
			'/api/auth/sign-in/magic-link',
			'/api/auth/email-otp/send-verification-otp',
			'/api/auth/magic-link/verify',
			'/api/auth/two-factor/verify-totp',
			'/api/auth/sign-in/social',
		]) {
			expect(authRateLimitBucket(path), path).toBe('auth');
		}
	});

	it('still refuses a sixth passkey verification in one window', () => {
		const paths = [AUTHORIZE, ...Array.from({ length: RATE_LIMIT_MAX + 1 }, () => PASSKEY_VERIFY)];
		expect(firstRefused(paths, authRateLimitBucket)).toBe(PASSKEY_VERIFY);
	});

	it('defaults unknown auth paths to the strict bucket', () => {
		expect(authRateLimitBucket('/api/auth/some-new-endpoint')).toBe('auth');
		expect(authRateLimitBucket('/api/auth/oauth2/authorize/extra')).toBe('auth');
	});

	it('keeps machine endpoints and callbacks on their own buckets', () => {
		expect(authRateLimitBucket('/api/auth/oauth2/token')).toBe('oauth-machine');
		expect(authRateLimitBucket('/api/auth/jwks')).toBe('oauth-machine');
		expect(authRateLimitBucket('/api/auth/callback/github')).toBe('oauth-callback');
	});
});
