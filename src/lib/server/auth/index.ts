import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { admin, emailOTP, magicLink, twoFactor } from 'better-auth/plugins';
import { env } from '$env/dynamic/private';
import {
	EMAIL_OTP_EXPIRES_IN,
	EMAIL_OTP_MAX_ATTEMPTS,
	MAGIC_LINK_EXPIRES_IN,
	SESSION_COOKIE_MAX_AGE,
	SESSION_EXPIRES_IN,
	SESSION_UPDATE_AGE,
	TWO_FACTOR_ISSUER,
} from '$lib/server/config';
// Use relative import — Better Auth CLI breaks on $lib aliases (Issue #2252)
import { db } from '../db';
import { touchPasskeyLastUsed } from '../db/user/queries';
import { type FactorChangeAction, onFactorChanged } from './factor-changes';
import { magicLinkTemplate, otpTemplate, sendAuthEmail } from './send-auth-email';
import { isStepUpFresh, stampStepUp } from './step-up';

function requireEnv(name: string): string {
	const value = env[name];
	if (!value) throw new Error(`Missing required environment variable: ${name}`);
	return value;
}

if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
	throw new Error('BETTER_AUTH_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 32');
}

const baseURL = requireEnv('BETTER_AUTH_URL');
const githubClientId = requireEnv('GITHUB_CLIENT_ID');
const githubClientSecret = requireEnv('GITHUB_CLIENT_SECRET');
const microsoftClientId = requireEnv('MICROSOFT_CLIENT_ID');
const microsoftClientSecret = requireEnv('MICROSOFT_CLIENT_SECRET');

/**
 * Passkeys are disabled on Vercel preview deployments at the plugin level
 * (endpoints 404, not just hidden UI): *.vercel.app is on the Public Suffix
 * List, so a preview URL can never satisfy the production rpID and a
 * half-working ceremony surface would only invite confusion.
 */
export const passkeysEnabled = env.VERCEL_ENV !== 'preview';

const baseUrlParsed = new URL(baseURL);

/**
 * Step-up enforcement + factor-change side effects.
 *
 * These global hooks are the single un-skippable chokepoint for passkey/TOTP
 * mutations — authClient calls hit the plugin endpoints directly, so form
 * actions can't carry the audit/notify/revoke duties.
 *
 * twoFactor's challenge flow never triggers for this app's passwordless
 * sign-in methods (by upstream design); TOTP here is exclusively a step-up
 * factor for sensitive actions, stamped on successful verification.
 */
const beforeHook = createAuthMiddleware(async (ctx) => {
	// Disabling TOTP / rotating backup codes must be proven by a live factor,
	// not just a session (upstream gates these on a password we don't have).
	if (ctx.path === '/two-factor/disable' || ctx.path === '/two-factor/generate-backup-codes') {
		const session = ctx.context.session ?? (await getSessionFromCtx(ctx));
		const user = session?.user as { id: string; twoFactorEnabled?: boolean | null } | undefined;
		if (user?.twoFactorEnabled && !(await isStepUpFresh(user.id))) {
			throw new APIError('FORBIDDEN', { message: 'step_up_required', code: 'STEP_UP_REQUIRED' });
		}
	}
});

const afterHook = createAuthMiddleware(async (ctx) => {
	if (ctx.context.returned instanceof APIError) return;

	const session = ctx.context.newSession ?? ctx.context.session ?? (await getSessionFromCtx(ctx).catch(() => null));
	const user = session?.user;
	if (!user) return;
	const ip = ctx.headers?.get('x-client-ip') ?? null;

	const factorChange = (action: FactorChangeAction, revokeSiblings = false, detail?: Record<string, unknown>) =>
		onFactorChanged({
			userId: user.id,
			userEmail: user.email,
			action,
			detail,
			ip,
			revokeSiblings,
			currentSessionToken: session?.session?.token ?? null,
		});

	switch (ctx.path) {
		case '/passkey/verify-registration':
			await factorChange('passkey.added');
			break;
		case '/passkey/delete-passkey':
			await factorChange('passkey.removed', true);
			break;
		case '/passkey/update-passkey':
			await factorChange('passkey.renamed');
			break;
		case '/passkey/verify-authentication': {
			// App-owned lastUsedAt; the plugin looks the credential up by the
			// assertion's id, so the same value keys our update. Fire-and-forget.
			const credentialID = (ctx.body as { response?: { id?: string } } | undefined)?.response?.id;
			if (credentialID) {
				touchPasskeyLastUsed(credentialID).catch((err) =>
					console.error('[auth] passkey lastUsedAt update failed:', err),
				);
			}
			break;
		}
		case '/two-factor/enable':
			await factorChange('2fa.enabled');
			break;
		case '/two-factor/disable':
			await factorChange('2fa.disabled', true);
			break;
		case '/two-factor/generate-backup-codes':
			await factorChange('2fa.backup_codes_regenerated');
			break;
		case '/two-factor/verify-totp':
		case '/two-factor/verify-backup-code':
			await stampStepUp(user.id);
			break;
	}
});

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: 'pg' }),
	secret: env.BETTER_AUTH_SECRET,
	baseURL,
	trustedOrigins: [baseURL],

	// Pin the IP source explicitly. hooks.server.ts stamps `x-client-ip` from
	// event.getClientAddress() (the platform-trusted source on Vercel) before
	// any handler runs. Without this pinning, Better Auth's default reads
	// x-forwarded-for first, which is mutable by clients on serverless origins
	// that don't sit behind a trusted proxy on every request path.
	advanced: {
		ipAddress: {
			ipAddressHeaders: ['x-client-ip'],
		},
		// Force the Secure cookie attribute explicitly rather than relying on
		// baseURL-scheme inference (which silently drops Secure on a misconfigured
		// http:// baseURL). Production is always https on Vercel.
		useSecureCookies: env.NODE_ENV === 'production',
	},

	emailAndPassword: { enabled: false },

	socialProviders: {
		github: {
			clientId: githubClientId,
			clientSecret: githubClientSecret,
		},
		// google: {
		// 	clientId: env.GOOGLE_CLIENT_ID!,
		// 	clientSecret: env.GOOGLE_CLIENT_SECRET!,
		// },
		microsoft: {
			clientId: microsoftClientId,
			clientSecret: microsoftClientSecret,
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

	hooks: {
		before: beforeHook,
		after: afterHook,
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
					subject: type === 'sign-in' ? 'v10r log-in code' : 'Your verification code',
					html: otpTemplate(otp),
				});
			},
			otpLength: 6,
			expiresIn: EMAIL_OTP_EXPIRES_IN,
			allowedAttempts: EMAIL_OTP_MAX_ATTEMPTS,
			sendVerificationOnSignUp: true,
		}),
		// TOTP is a step-up factor only: passwordless sign-ins are never
		// challenged (upstream scopes the challenge to credential sign-in),
		// and allowPasswordless lets credential-less users manage enrollment.
		twoFactor({
			issuer: TWO_FACTOR_ISSUER,
			allowPasswordless: true,
			skipVerificationOnEnable: false,
		}),
		...(passkeysEnabled
			? [
					passkey({
						rpID: baseUrlParsed.hostname,
						rpName: 'Velociraptor',
						origin: baseUrlParsed.origin,
					}),
				]
			: []),
	],
});

export type Auth = typeof auth;
