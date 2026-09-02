/**
 * AUTH SHOWCASE FIXTURE — fabricated, schema-faithful data for the
 * Identity & Access showcase.
 *
 * This module has ZERO imports from `$lib/server/*` or `$env/*` and is
 * therefore safe to import directly into public, client-rendered pages.
 * The auth showcase has no `+page.server.ts` and never touches the real
 * auth subsystem — every row here is invented.
 *
 * Conventions (also enforced by leak-gate.test.ts):
 *  - all ids are `demo_`-prefixed, never real UUIDs
 *  - all emails are `@example.com`
 *  - all IPs are in 192.0.2.0/24 (RFC 5737 TEST-NET-1)
 *  - credential-bearing columns are the literal sentinel `«never selected»`,
 *    never a realistic-looking secret
 */

import type { DateFormat, DisplayDensity, Theme } from '$lib/types/db-enums';

export const SECRET_SENTINEL = '«never selected»' as const;
type Secret = typeof SECRET_SENTINEL;

/** Mirrors auth.user (incl. admin-plugin columns). */
export interface FixtureUser {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	createdAt: string;
	updatedAt: string;
	role: string;
	banned: boolean;
	bannedAt: string | null;
	banReason: string | null;
}

/** Mirrors auth.session (incl. impersonatedBy). `_lifecycle` drives the UI. */
export interface FixtureSession {
	id: string;
	userId: string;
	token: Secret;
	expiresAt: string;
	createdAt: string;
	updatedAt: string;
	ipAddress: string;
	userAgent: string;
	impersonatedBy: string | null;
	_lifecycle: 'active' | 'impersonated' | 'expired';
}

/** Mirrors auth.account. Token/password columns are sentinels only. */
export interface FixtureAccount {
	id: string;
	userId: string;
	accountId: string;
	providerId: string;
	scope: string | null;
	accessToken: Secret;
	refreshToken: Secret;
	idToken: Secret;
	password: Secret;
	accessTokenExpiresAt: string | null;
	refreshTokenExpiresAt: string | null;
	createdAt: string;
	updatedAt: string;
}

/** Mirrors auth.verification. `value` is a sentinel (it holds live tokens). */
export interface FixtureVerification {
	id: string;
	identifier: string;
	value: Secret;
	expiresAt: string;
	createdAt: string;
	updatedAt: string;
	_lifecycle: 'fresh' | 'expired';
}

/** Mirrors app.user_preferences (PK === FK to auth.user.id). */
export interface FixturePreferences {
	userId: string;
	theme: Theme;
	displayDensity: DisplayDensity;
	sidebarWidth: number;
	locale: string;
	timezone: string;
	dateFormat: DateFormat;
	reduceMotion: boolean;
	highContrast: boolean;
	paletteId: string | null;
	typographyId: string | null;
	radiusId: string | null;
	updatedAt: string;
}

/** Mirrors admin.audit_log (no FK on actorId; actorEmail denormalized). */
export interface FixtureAuditRow {
	id: number;
	action: string;
	actorId: string;
	actorEmail: string;
	targetType: string | null;
	targetId: string | null;
	detail: { before?: unknown; after?: unknown; meta?: unknown } | null;
	ipAddress: string;
	occurredAt: string;
}

/** One FK edge + its real ON DELETE behavior, for the ERD/cascade demo. */
export interface FixtureEdge {
	from: string;
	to: string;
	fk: string;
	onDelete: 'cascade' | 'set null' | 'no action (no FK)';
	note: string;
}

const ADA = 'demo_user_01';
const LIN = 'demo_user_02';

export const fixtureUsers: FixtureUser[] = [
	{
		id: ADA,
		name: 'Ada (demo)',
		email: 'ada@example.com',
		emailVerified: true,
		image: null,
		createdAt: '2026-01-04T09:12:00.000Z',
		updatedAt: '2026-05-02T18:40:00.000Z',
		role: 'user',
		banned: false,
		bannedAt: null,
		banReason: null,
	},
	{
		id: LIN,
		name: 'Lin (demo)',
		email: 'lin@example.com',
		emailVerified: true,
		image: null,
		createdAt: '2026-02-19T14:05:00.000Z',
		updatedAt: '2026-05-10T08:22:00.000Z',
		role: 'author',
		banned: false,
		bannedAt: null,
		banReason: null,
	},
];

export const fixtureSessions: FixtureSession[] = [
	{
		id: 'demo_sess_active',
		userId: ADA,
		token: SECRET_SENTINEL,
		expiresAt: '2026-05-26T09:00:00.000Z',
		createdAt: '2026-05-19T09:00:00.000Z',
		updatedAt: '2026-05-19T09:00:00.000Z',
		ipAddress: '192.0.2.10',
		userAgent: 'ExampleBrowser/1.0 (Demo)',
		impersonatedBy: null,
		_lifecycle: 'active',
	},
	{
		id: 'demo_sess_imp',
		userId: LIN,
		token: SECRET_SENTINEL,
		expiresAt: '2026-05-26T11:30:00.000Z',
		createdAt: '2026-05-19T11:30:00.000Z',
		updatedAt: '2026-05-19T11:30:00.000Z',
		ipAddress: '192.0.2.24',
		userAgent: 'ExampleBrowser/1.0 (Demo)',
		impersonatedBy: 'demo_user_admin',
		_lifecycle: 'impersonated',
	},
	{
		id: 'demo_sess_expired',
		userId: ADA,
		token: SECRET_SENTINEL,
		expiresAt: '2026-05-05T07:00:00.000Z',
		createdAt: '2026-04-28T07:00:00.000Z',
		updatedAt: '2026-04-28T07:00:00.000Z',
		ipAddress: '192.0.2.10',
		userAgent: 'ExampleBrowser/1.0 (Demo)',
		impersonatedBy: null,
		_lifecycle: 'expired',
	},
];

export const fixtureAccounts: FixtureAccount[] = [
	{
		id: 'demo_acct_github',
		userId: ADA,
		accountId: 'github|demo',
		providerId: 'github',
		scope: 'read:user user:email',
		accessToken: SECRET_SENTINEL,
		refreshToken: SECRET_SENTINEL,
		idToken: SECRET_SENTINEL,
		password: SECRET_SENTINEL,
		accessTokenExpiresAt: '2026-05-19T10:00:00.000Z',
		refreshTokenExpiresAt: null,
		createdAt: '2026-01-04T09:12:00.000Z',
		updatedAt: '2026-05-02T18:40:00.000Z',
	},
	{
		id: 'demo_acct_cred',
		userId: LIN,
		accountId: LIN,
		providerId: 'credential',
		scope: null,
		accessToken: SECRET_SENTINEL,
		refreshToken: SECRET_SENTINEL,
		idToken: SECRET_SENTINEL,
		password: SECRET_SENTINEL,
		accessTokenExpiresAt: null,
		refreshTokenExpiresAt: null,
		createdAt: '2026-02-19T14:05:00.000Z',
		updatedAt: '2026-02-19T14:05:00.000Z',
	},
];

export const fixtureVerifications: FixtureVerification[] = [
	{
		id: 'demo_vrf_fresh',
		identifier: 'ada@example.com',
		value: SECRET_SENTINEL,
		expiresAt: '2026-05-19T09:05:00.000Z',
		createdAt: '2026-05-19T09:00:00.000Z',
		updatedAt: '2026-05-19T09:00:00.000Z',
		_lifecycle: 'fresh',
	},
	{
		id: 'demo_vrf_expired',
		identifier: 'lin@example.com',
		value: SECRET_SENTINEL,
		expiresAt: '2026-05-10T08:27:00.000Z',
		createdAt: '2026-05-10T08:22:00.000Z',
		updatedAt: '2026-05-10T08:22:00.000Z',
		_lifecycle: 'expired',
	},
];

export const fixturePreferences: FixturePreferences[] = [
	{
		userId: ADA,
		theme: 'system',
		displayDensity: 'comfortable',
		sidebarWidth: 240,
		locale: 'en',
		timezone: 'UTC',
		dateFormat: 'relative',
		reduceMotion: false,
		highContrast: false,
		paletteId: null,
		typographyId: null,
		radiusId: null,
		updatedAt: '2026-05-02T18:40:00.000Z',
	},
	{
		userId: LIN,
		theme: 'dark',
		displayDensity: 'compact',
		sidebarWidth: 280,
		locale: 'de',
		timezone: 'Europe/Berlin',
		dateFormat: 'absolute',
		reduceMotion: true,
		highContrast: false,
		paletteId: null,
		typographyId: null,
		radiusId: null,
		updatedAt: '2026-05-10T08:22:00.000Z',
	},
];

export const fixtureAuditLog: FixtureAuditRow[] = [
	{
		id: 4,
		action: 'user.ban',
		actorId: 'demo_user_admin',
		actorEmail: 'admin@example.com',
		targetType: 'user',
		targetId: LIN,
		detail: { before: { banned: false }, after: { banned: true }, meta: { reason: 'demo' } },
		ipAddress: '192.0.2.2',
		occurredAt: '2026-05-18T16:40:00.000Z',
	},
	{
		id: 3,
		action: 'user.role.set',
		actorId: 'demo_user_admin',
		actorEmail: 'admin@example.com',
		targetType: 'user',
		targetId: LIN,
		detail: { before: { role: 'user' }, after: { role: 'author' } },
		ipAddress: '192.0.2.2',
		occurredAt: '2026-05-12T10:15:00.000Z',
	},
	{
		id: 2,
		action: 'user.impersonate.start',
		actorId: 'demo_user_admin',
		actorEmail: 'admin@example.com',
		targetType: 'user',
		targetId: LIN,
		detail: { meta: { sessionId: 'demo_sess_imp' } },
		ipAddress: '192.0.2.2',
		occurredAt: '2026-05-19T11:30:00.000Z',
	},
	{
		id: 1,
		action: 'auth.signin',
		actorId: ADA,
		actorEmail: 'ada@example.com',
		targetType: 'session',
		targetId: 'demo_sess_active',
		detail: { meta: { method: 'magic-link' } },
		ipAddress: '192.0.2.10',
		occurredAt: '2026-05-19T09:00:00.000Z',
	},
];

/** ON DELETE behavior per FK — the cascade-visualizer lesson. */
export const fixtureEdges: FixtureEdge[] = [
	{
		from: 'user',
		to: 'session',
		fk: 'session.user_id',
		onDelete: 'cascade',
		note: 'Sessions vanish with the user.',
	},
	{
		from: 'user',
		to: 'account',
		fk: 'account.user_id',
		onDelete: 'cascade',
		note: 'OAuth/credential links vanish with the user.',
	},
	{
		from: 'user',
		to: 'user_preferences',
		fk: 'user_preferences.user_id (PK === FK)',
		onDelete: 'cascade',
		note: 'PK is the FK — strict 1:1, dies with the parent.',
	},
	{
		from: 'user',
		to: 'verification',
		fk: '(none — identifier is an email string)',
		onDelete: 'no action (no FK)',
		note: 'Verification rows are TTL-reaped, not FK-bound — orphans survive a user delete.',
	},
	{
		from: 'user',
		to: 'audit_log',
		fk: '(none — actor_id has no FK by design)',
		onDelete: 'no action (no FK)',
		note: 'Audit trail must outlive the actor; actor_email is denormalized for that reason.',
	},
];

export const authFixture = {
	users: fixtureUsers,
	sessions: fixtureSessions,
	accounts: fixtureAccounts,
	verifications: fixtureVerifications,
	preferences: fixturePreferences,
	auditLog: fixtureAuditLog,
	edges: fixtureEdges,
} as const;

export type AuthFixture = typeof authFixture;
