import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import {
	BETTER_AUTH_SECRET,
	BETTER_AUTH_URL,
	GITHUB_CLIENT_ID,
	GITHUB_CLIENT_SECRET,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
} from '$env/static/private';
// Use relative import — Better Auth CLI breaks on $lib aliases (Issue #2252)
import { db } from '../db';

if (!BETTER_AUTH_SECRET || BETTER_AUTH_SECRET.length < 32) {
	throw new Error(
		'BETTER_AUTH_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 32',
	);
}

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: 'pg' }),
	secret: BETTER_AUTH_SECRET,
	baseURL: BETTER_AUTH_URL,
	trustedOrigins: [BETTER_AUTH_URL],

	emailAndPassword: { enabled: false },

	socialProviders: {
		github: {
			clientId: GITHUB_CLIENT_ID,
			clientSecret: GITHUB_CLIENT_SECRET,
		},
		google: {
			clientId: GOOGLE_CLIENT_ID,
			clientSecret: GOOGLE_CLIENT_SECRET,
		},
	},

	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24, // Refresh every 24h on activity

		cookieCache: {
			enabled: true,
			maxAge: 60 * 5, // Revalidate every 5 min
		},
	},
});

export type Auth = typeof auth;
