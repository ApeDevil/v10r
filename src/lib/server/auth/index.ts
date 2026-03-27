import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, emailOTP, magicLink } from 'better-auth/plugins';
import {
	BETTER_AUTH_SECRET,
	BETTER_AUTH_URL,
	GITHUB_CLIENT_ID,
	GITHUB_CLIENT_SECRET,
	// GOOGLE_CLIENT_ID,
	// GOOGLE_CLIENT_SECRET,
	MICROSOFT_CLIENT_ID,
	MICROSOFT_CLIENT_SECRET,
} from '$env/static/private';
import {
	EMAIL_OTP_EXPIRES_IN,
	EMAIL_OTP_MAX_ATTEMPTS,
	MAGIC_LINK_EXPIRES_IN,
	SESSION_COOKIE_MAX_AGE,
	SESSION_EXPIRES_IN,
	SESSION_UPDATE_AGE,
} from '$lib/server/config';
// Use relative import — Better Auth CLI breaks on $lib aliases (Issue #2252)
import { db } from '../db';
import { magicLinkTemplate, otpTemplate, sendAuthEmail } from './send-auth-email';

if (!BETTER_AUTH_SECRET || BETTER_AUTH_SECRET.length < 32) {
	throw new Error('BETTER_AUTH_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 32');
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
		// google: {
		// 	clientId: GOOGLE_CLIENT_ID,
		// 	clientSecret: GOOGLE_CLIENT_SECRET,
		// },
		microsoft: {
			clientId: MICROSOFT_CLIENT_ID,
			clientSecret: MICROSOFT_CLIENT_SECRET,
			tenantId: 'common',
		},
	},

	session: {
		expiresIn: SESSION_EXPIRES_IN,
		updateAge: SESSION_UPDATE_AGE,

		cookieCache: {
			enabled: true,
			maxAge: SESSION_COOKIE_MAX_AGE,
		},
	},

	plugins: [
		magicLink({
			sendMagicLink: async ({ email, url }: { email: string; url: string }) => {
				await sendAuthEmail({
					to: email,
					subject: 'Sign in to Velociraptor',
					html: magicLinkTemplate(url),
				});
			},
			expiresIn: MAGIC_LINK_EXPIRES_IN,
		}),
		admin(),
		emailOTP({
			sendVerificationOTP: async ({ email, otp, type }: { email: string; otp: string; type: string }) => {
				await sendAuthEmail({
					to: email,
					subject: type === 'sign-in' ? 'Your sign-in code' : 'Your verification code',
					html: otpTemplate(otp),
				});
			},
			otpLength: 6,
			expiresIn: EMAIL_OTP_EXPIRES_IN,
			allowedAttempts: EMAIL_OTP_MAX_ATTEMPTS,
			sendVerificationOnSignUp: true,
		}),
	],
});

export type Auth = typeof auth;
