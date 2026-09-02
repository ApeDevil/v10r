import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { emailOTP, magicLink, twoFactor } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
// Use relative import — Better Auth CLI breaks on $lib aliases (Issue #2252)
import { db } from '../db';
import { user as userTable } from '../db/schema/auth/_better-auth';
import { countPasskeys, touchPasskeyLastUsed } from '../db/user/queries';
import {
	EMAIL_OTP_EXPIRES_IN,
	EMAIL_OTP_MAX_ATTEMPTS,
	MAGIC_LINK_EXPIRES_IN,
	SESSION_COOKIE_MAX_AGE,
	SESSION_EXPIRES_IN,
	SESSION_UPDATE_AGE,
	TWO_FACTOR_ISSUER,
} from './config';
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
const googleClientId = requireEnv('GOOGLE_CLIENT_ID');
const googleClientSecret = requireEnv('GOOGLE_CLIENT_SECRET');

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
/**
 * Paths that need a freshly proven factor, not merely a valid session.
 *
 * Passkey registration belongs here because a passkey is a full SIGN-IN method
 * in this app, not just a second factor: minting one from a stolen session
 * cookie converts temporary session theft into durable account access that
 * survives signing out everywhere. (It is notified and audited — see
 * factor-changes.ts — so the victim is not blind, but detection is not the
 * same as prevention.)
 */
const STEP_UP_REQUIRED_PATHS = new Set([
	'/two-factor/disable',
	'/two-factor/generate-backup-codes',
	'/passkey/verify-registration',
]);

const beforeHook = createAuthMiddleware(async (ctx) => {
	// Disabling TOTP / rotating backup codes must be proven by a live factor,
	// not just a session (upstream gates these on a password we don't have).
	if (STEP_UP_REQUIRED_PATHS.has(ctx.path)) {
		const session = ctx.context.session ?? (await getSessionFromCtx(ctx));
		const user = session?.user as { id: string; twoFactorEnabled?: boolean | null } | undefined;
		if (!user) return;

		// Step-up can only be demanded of someone who HAS a factor to prove.
		// Requiring it to enrol a first passkey would lock every factorless user
		// out of ever gaining one; requiring it for the second onwards is what
		// stops a stolen session cookie from quietly minting durable access.
		const hasFactor = user.twoFactorEnabled === true || (await countPasskeys(user.id)) > 0;

		if (hasFactor && !(await isStepUpFresh(user.id))) {
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

	/**
	 * OAuth provider tokens are encrypted at rest.
	 *
	 * `auth.account` holds `access_token`, `refresh_token` and `id_token` as
	 * plain text columns. A read-only database leak — a connection string, a Neon
	 * branch, a logical backup — therefore exposed live GitHub and Google
	 * credentials alongside the account linkage, usable until they expire.
	 *
	 * This is Better Auth's own supported flag rather than a hand-rolled column
	 * transform, which matters: ad-hoc ciphertext the framework cannot read would
	 * break its refresh path the first time anything needed it, and would do so
	 * long after the change, in a code path nobody was looking at.
	 *
	 * v10r never consumes these tokens — the providers are used for identity
	 * only, and `getUserOAuthSummary` projects them to presence booleans at query
	 * level so they cannot leave the database layer. That is why the egress side
	 * was already clean and only storage remained.
	 *
	 * Rows written before this was enabled stay plaintext; nothing reads them, and
	 * they are overwritten on the account holder's next sign-in.
	 */
	account: {
		encryptOAuthTokens: true,
	},

	/**
	 * `banned` / `banReason` were surfaced on the session user by the admin
	 * plugin; with that plugin gone they exist in Postgres but are invisible to
	 * Better Auth unless declared here. `input: false` keeps them server-owned —
	 * a client must never be able to set its own ban state at sign-up.
	 */
	user: {
		additionalFields: {
			banned: { type: 'boolean', required: false, input: false },
			banReason: { type: 'string', required: false, input: false },
		},
	},

	databaseHooks: {
		session: {
			create: {
				/**
				 * Refusing at session CREATION is the other half of the ban.
				 * `sessionPopulate` rejects a banned user's existing sessions, but
				 * nothing stopped them signing in again and minting a fresh one —
				 * with the admin plugin removed, no upstream code enforces this.
				 * One DB read per sign-in, which is rare.
				 */
				before: async (session) => {
					const [row] = await db
						.select({ banned: userTable.banned })
						.from(userTable)
						.where(eq(userTable.id, session.userId))
						.limit(1);
					if (row?.banned) {
						throw new APIError('FORBIDDEN', { message: 'account_banned', code: 'ACCOUNT_BANNED' });
					}
					return { data: session };
				},
			},
		},
	},

	/**
	 * Scopes are deliberately NOT declared.
	 *
	 * Both providers fall back to their identity-only defaults — `user:email` for
	 * GitHub, `openid email profile` for Google — which is already the minimum
	 * this app needs, since it consumes no provider API. Re-stating them here
	 * would add a way to get sign-in wrong (OAuth is the only way in; there is no
	 * password path) without removing a single permission. If a provider API is
	 * ever called, that is the moment to pin the scope list explicitly.
	 */
	socialProviders: {
		github: {
			clientId: githubClientId,
			clientSecret: githubClientSecret,
		},
		google: {
			clientId: googleClientId,
			clientSecret: googleClientSecret,
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

	/**
	 * The Better Auth `admin()` plugin is deliberately NOT enabled.
	 *
	 * It authorizes on the `user.role` DB column, which would put a second
	 * privilege plane next to this app's `ADMIN_USER_ID` env list — and mounts
	 * ~16 endpoints under /api/auth/admin/* including `impersonate-user`, which
	 * mints a real session as another user. Because `svelteKitHandler` answers
	 * /api/auth/* without calling resolve(), that plane also sits outside the
	 * csrfProtection / sessionPopulate / devRouteGuard handlers entirely.
	 *
	 * The env-list design exists precisely so that database write access cannot
	 * confer admin. Enabling this plugin would hand that property back. Ban and
	 * unban are implemented directly against the schema instead — see
	 * routes/[[locale=locale]]/admin/users/+page.server.ts.
	 */
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
