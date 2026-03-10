import { BETTER_AUTH_URL } from '$env/static/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		headers: {
			'X-Frame-Options': 'DENY',
			'X-Content-Type-Options': 'nosniff',
			'Referrer-Policy': 'strict-origin-when-cross-origin',
			'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
		},
		csrf: {
			enabled: true,
			description: 'SvelteKit built-in CSRF protection via Origin header checking',
		},
		trustedOrigins: [BETTER_AUTH_URL],
		rateLimiting: {
			builtin: 'Disabled (broken in Better Auth — Issue #2153)',
			external: 'Upstash Redis rate limiter on /api/auth/sign-in/*',
		},
		betterAuthVersion: '1.4.6',
		measuredAt: new Date().toISOString(),
	};
};
