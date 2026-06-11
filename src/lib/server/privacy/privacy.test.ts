/**
 * Privacy module tests — the compliance contracts, not the happy path:
 * 1. Secret columns never cross out of collectUserData (tokens, password).
 * 2. Prior-session IPs are masked; the current session stays raw.
 * 3. Sections degrade independently — a report is produced even when empty.
 * 4. consumeTransparencyMarker fires exactly once per user (atomic).
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { account, session, user } from '$lib/server/db/schema/auth/_better-auth';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { db } = await import('$lib/server/db');
const { collectUserData, maskIp } = await import('./report');
const { deleteUserData } = await import('./mutations');
const { consumeTransparencyMarker, hasSeenTransparency, getOrCreatePreferences } = await import(
	'$lib/server/db/preferences'
);

afterAll(async () => {
	await testClient?.close();
});

const USER_ID = 'usr_privacy_test_1';
const CURRENT_SESSION = 'ses_current_1';
const SECRET_ACCESS_TOKEN = 'gho_SUPER_SECRET_ACCESS_abc123';
const SECRET_REFRESH_TOKEN = 'ghr_SUPER_SECRET_REFRESH_xyz789';
const SECRET_SESSION_TOKEN = 'tok_SUPER_SECRET_SESSION_qrs456';

async function seedUser() {
	await db.insert(user).values({
		id: USER_ID,
		name: 'Privacy Tester',
		email: 'privacy@example.com',
	});
	await db.insert(session).values([
		{
			id: CURRENT_SESSION,
			token: SECRET_SESSION_TOKEN,
			userId: USER_ID,
			expiresAt: new Date(Date.now() + 86_400_000),
			ipAddress: '203.0.113.42',
			userAgent: 'Mozilla/5.0 (Current)',
		},
		{
			id: 'ses_prior_1',
			token: 'tok_prior_secret',
			userId: USER_ID,
			expiresAt: new Date(Date.now() + 86_400_000),
			ipAddress: '198.51.100.7',
			userAgent: 'Mozilla/5.0 (Prior)',
		},
	]);
	await db.insert(account).values({
		id: 'acc_1',
		accountId: 'github-123',
		providerId: 'github',
		userId: USER_ID,
		accessToken: SECRET_ACCESS_TOKEN,
		refreshToken: SECRET_REFRESH_TOKEN,
		scope: 'read:user user:email',
	});
}

beforeEach(async () => {
	await db.delete(user); // cascades sessions/accounts/preferences
});

// ── maskIp ────────────────────────────────────────────────────────────────────

describe('maskIp', () => {
	it('keeps first two IPv4 octets only', () => {
		expect(maskIp('198.51.100.7')).toBe('198.51.xxx.xxx');
	});

	it('keeps first two IPv6 groups only', () => {
		expect(maskIp('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:xxxx:xxxx:xxxx:xxxx');
	});
});

// ── collectUserData — secret projection ──────────────────────────────────────

describe('collectUserData — no secrets cross out', () => {
	it('report never contains token values or raw prior IPs anywhere', async () => {
		await seedUser();
		const report = await collectUserData(USER_ID, { currentSessionId: CURRENT_SESSION });
		const serialized = JSON.stringify(report);

		expect(serialized).not.toContain(SECRET_ACCESS_TOKEN);
		expect(serialized).not.toContain(SECRET_REFRESH_TOKEN);
		expect(serialized).not.toContain(SECRET_SESSION_TOKEN);
		expect(serialized).not.toContain('tok_prior_secret');
		// prior IP appears only masked
		expect(serialized).not.toContain('198.51.100.7');
		expect(serialized).toContain('198.51.xxx.xxx');
	});

	it('current session keeps its raw IP — the requester’s own connection', async () => {
		await seedUser();
		const report = await collectUserData(USER_ID, { currentSessionId: CURRENT_SESSION });
		expect(report.sessions.data?.current?.ipAddress).toBe('203.0.113.42');
		expect(report.sessions.data?.current?.isCurrent).toBe(true);
		expect(report.sessions.data?.prior).toHaveLength(1);
		expect(report.sessions.data?.prior[0]?.ipAddress).toBe('198.51.xxx.xxx');
	});

	it('OAuth tokens reduce to presence booleans + scope', async () => {
		await seedUser();
		const report = await collectUserData(USER_ID, { currentSessionId: CURRENT_SESSION });
		const gh = report.oauthAccounts.data?.[0];
		expect(gh?.provider).toBe('github');
		expect(gh?.scope).toBe('read:user user:email');
		expect(gh?.hasAccessToken).toBe(true);
		expect(gh?.hasRefreshToken).toBe(true);
		expect(gh && 'accessToken' in gh).toBe(false);
	});
});

// ── collectUserData — shape + degrade ────────────────────────────────────────

describe('collectUserData — report shape', () => {
	it('produces a full report with zero counts for a fresh user', async () => {
		await seedUser();
		const report = await collectUserData(USER_ID, { currentSessionId: CURRENT_SESSION });

		expect(report.meta.userId).toBe(USER_ID);
		expect(report.meta.art15).toBe(true);
		expect(report.ai.data?.conversationCount).toBe(0);
		expect(report.desk.data?.workspaceCount).toBe(0);
		expect(report.blogComments.data?.count).toBe(0);
		expect(report.palettes.data?.count).toBe(0);
		expect(report.notifications.data?.telegramLinked).toBe(false);
		expect(report.preferences.data).toBeNull(); // read-only — must NOT create a row
	});

	it('identity section degrades for a nonexistent user instead of throwing', async () => {
		const report = await collectUserData('usr_does_not_exist');
		expect(report.identity.available).toBe(false);
		expect(report.identity.data).toBeNull();
		// other sections still resolve (empty)
		expect(report.ai.available).toBe(true);
	});

	it('analytics visitor trail is absent — no re-identification without Art 6(4) basis', async () => {
		await seedUser();
		const report = await collectUserData(USER_ID, { currentSessionId: CURRENT_SESSION });
		expect(JSON.stringify(report)).not.toContain('visitorId');
	});
});

// ── deleteUserData ────────────────────────────────────────────────────────────

describe('deleteUserData', () => {
	it('cascade-deletes sessions and accounts with the user row, idempotently', async () => {
		await seedUser();
		await deleteUserData(USER_ID);

		expect(await db.select().from(user)).toHaveLength(0);
		expect(await db.select().from(session)).toHaveLength(0);
		expect(await db.select().from(account)).toHaveLength(0);

		// second call is a no-op, not an error
		await expect(deleteUserData(USER_ID)).resolves.toBeUndefined();
	});
});

// ── consumeTransparencyMarker ────────────────────────────────────────────────

describe('consumeTransparencyMarker — exactly once', () => {
	it('returns true on first call, false on every subsequent call', async () => {
		await seedUser();
		expect(await hasSeenTransparency(USER_ID)).toBe(false);

		expect(await consumeTransparencyMarker(USER_ID)).toBe(true);
		expect(await consumeTransparencyMarker(USER_ID)).toBe(false);
		expect(await consumeTransparencyMarker(USER_ID)).toBe(false);

		expect(await hasSeenTransparency(USER_ID)).toBe(true);
	});

	it('consumes once even when a preferences row pre-exists (UPDATE path)', async () => {
		await seedUser();
		await getOrCreatePreferences(USER_ID); // row exists, transparencySeenAt NULL

		expect(await consumeTransparencyMarker(USER_ID)).toBe(true);
		expect(await consumeTransparencyMarker(USER_ID)).toBe(false);
	});

	it('concurrent consumes — only one wins (prefetch + navigation race)', async () => {
		await seedUser();
		const results = await Promise.all([
			consumeTransparencyMarker(USER_ID),
			consumeTransparencyMarker(USER_ID),
			consumeTransparencyMarker(USER_ID),
		]);
		expect(results.filter(Boolean)).toHaveLength(1);
	});
});
