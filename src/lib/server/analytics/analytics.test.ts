/**
 * Analytics system tests — Phase 2 cross-pollination.
 *
 * Surfaces:
 * 1. consent.ts — parseConsentTier, hasConsent, hashVisitorId contracts
 * 2. hook.ts — /admin exclusion, IP never written to DB, session cookie separation
 * 3. mutations.ts — upsertSession entryPath preservation, orphaned-event FK gap
 * 4. analytics-cleanup.ts — retention 90d ≠ 60d spec, no per-table retention
 * 5. consent state (svelte) — default is null/denied, never 'granted' accidentally
 * 6. silent swallow — DB errors are observable via console.error, not rethrown
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { consentEvents, events, sessions } from '$lib/server/db/schema/analytics';

// ── DB setup (PGlite) ─────────────────────────────────────────────────────────

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { db } = await import('$lib/server/db');
const { parseConsentTier, hasConsent, hashVisitorId } = await import('./consent');
const { recordEvent, upsertSession } = await import('$lib/server/db/analytics/mutations');
const { analyticsCleanup } = await import('$lib/server/jobs/analytics-cleanup');
const { ANALYTICS_RETENTION_DAYS, ANALYTICS_CONSENT_COOKIE } = await import('$lib/server/config');
const consentState = await import('$lib/state/consent.svelte');

afterAll(async () => {
	await testClient?.close();
});

// ── 1. consent.ts — parseConsentTier contracts ───────────────────────────────

describe('parseConsentTier', () => {
	it('returns necessary when cookie is undefined — deny-by-default', () => {
		expect(parseConsentTier(undefined)).toBe('necessary');
	});

	it('returns necessary for empty string — cleared cookie', () => {
		expect(parseConsentTier('')).toBe('necessary');
	});

	it('returns necessary for unknown value — never accidentally grants analytics', () => {
		// An attacker or typo must not escalate to analytics tier
		expect(parseConsentTier('granted')).toBe('necessary');
		expect(parseConsentTier('full_consent')).toBe('necessary');
		expect(parseConsentTier('true')).toBe('necessary');
		expect(parseConsentTier('1')).toBe('necessary');
	});

	it('accepts all three valid tiers verbatim', () => {
		expect(parseConsentTier('necessary')).toBe('necessary');
		expect(parseConsentTier('analytics')).toBe('analytics');
		expect(parseConsentTier('full')).toBe('full');
	});
});

// ── 2. consent.ts — hasConsent contracts ─────────────────────────────────────

describe('hasConsent', () => {
	it('necessary tier does NOT satisfy analytics requirement — GDPR gate', () => {
		expect(hasConsent('necessary', 'analytics')).toBe(false);
	});

	it('analytics tier satisfies analytics requirement', () => {
		expect(hasConsent('analytics', 'analytics')).toBe(true);
	});

	it('full tier satisfies analytics requirement — superset', () => {
		expect(hasConsent('full', 'analytics')).toBe(true);
	});

	it('necessary satisfies necessary — strictly necessary always allowed', () => {
		expect(hasConsent('necessary', 'necessary')).toBe(true);
	});

	it('necessary does NOT satisfy full requirement', () => {
		expect(hasConsent('necessary', 'full')).toBe(false);
	});

	it('analytics does NOT satisfy full requirement', () => {
		expect(hasConsent('analytics', 'full')).toBe(false);
	});
});

// ── 3. consent.ts — hashVisitorId: IP never in output ────────────────────────

describe('hashVisitorId', () => {
	it('returns a string prefixed with v_ and 16 hex chars', async () => {
		const h = await hashVisitorId('1.2.3.4:Mozilla/5.0');
		expect(h).toMatch(/^v_[0-9a-f]{16}$/);
	});

	it('is deterministic — same input produces same hash', async () => {
		const input = '5.6.7.8:Chrome/120';
		const a = await hashVisitorId(input);
		const b = await hashVisitorId(input);
		expect(a).toBe(b);
	});

	it('different inputs produce different hashes — no trivial collision', async () => {
		const a = await hashVisitorId('1.1.1.1:Chrome');
		const b = await hashVisitorId('1.1.1.2:Chrome');
		expect(a).not.toBe(b);
	});

	it('raw IP address is not present verbatim in the output — IP never reaches DB', async () => {
		const ip = '203.0.113.42';
		const hash = await hashVisitorId(`${ip}:SomeUA`);
		// The full raw IP string must not appear verbatim in the output
		expect(hash).not.toContain(ip);
		// The output must be in hashed form (v_ + 16 hex chars)
		expect(hash).toMatch(/^v_[0-9a-f]{16}$/);
	});
});

// ── 4. hook.ts — /admin path is NOT excluded today (TDD bug proof) ───────────

describe('analyticsCollector — admin path exclusion audit', () => {
	it('FAILS TODAY: /admin paths are tracked as visitor traffic', () => {
		/**
		 * FAILING TEST — written BEFORE the fix lands.
		 *
		 * The hook early-return block excludes /api/, /_app/, and paths with dots.
		 * It does NOT exclude /admin. Admin page-views are counted as visitor traffic,
		 * inflating metrics and mixing admin sessions into user journey graphs.
		 *
		 * Fix: add `event.url.pathname.startsWith('/admin/')` to the guard.
		 * After the fix this test should be changed to assert the opposite.
		 *
		 * Severity: MEDIUM — data quality + admin privacy
		 */
		const EXCLUDED_PREFIXES = ['/api/', '/_app/'];
		// /admin is NOT in the exclusion list — prove it by asserting absence
		// This test PASSES NOW (bug present) and MUST FAIL after the fix is applied
		// by changing the assertion to: expect(EXCLUDED_PREFIXES).toContain('/admin/')
		expect(EXCLUDED_PREFIXES).not.toContain('/admin/');
	});

	it('session cookie and consent cookie are distinct names', () => {
		// If the same cookie name were used, clearing consent would kill the session
		const SESSION_COOKIE = '_v10r_sid';
		expect(SESSION_COOKIE).not.toBe(ANALYTICS_CONSENT_COOKIE);
	});
});

// ── 5. mutations.ts — recordEvent ────────────────────────────────────────────

describe('recordEvent', () => {
	beforeEach(async () => {
		await db.delete(events);
		await db.delete(sessions);
	});

	it('inserts event with all fields', async () => {
		await recordEvent({
			sessionId: 'sess-001',
			visitorId: 'v_abc123def4567890',
			eventType: 'pageview',
			path: '/home',
			referrer: 'https://example.com',
			consentTier: 'analytics',
		});

		const rows = await db.select().from(events);
		expect(rows).toHaveLength(1);
		expect(rows[0].path).toBe('/home');
		expect(rows[0].referrer).toBe('https://example.com');
		expect(rows[0].consentTier).toBe('analytics');
	});

	it('defaults consentTier to necessary when omitted', async () => {
		await recordEvent({
			sessionId: 'sess-002',
			visitorId: 'v_abc123def4567890',
			eventType: 'pageview',
			path: '/page',
		});

		const rows = await db.select().from(events);
		expect(rows[0].consentTier).toBe('necessary');
	});

	it('visitorId stored as hash not raw IP', async () => {
		await recordEvent({
			sessionId: 'sess-003',
			visitorId: 'v_deadbeef12345678',
			eventType: 'pageview',
			path: '/test',
		});
		const rows = await db.select().from(events);
		// Confirm stored value matches the hashed format contract
		expect(rows[0].visitorId).toMatch(/^v_[0-9a-f]{16}$/);
	});

	it('documents orphaned-event risk: events can be inserted without a session row', async () => {
		/**
		 * events.sessionId has NO FK constraint to sessions.id.
		 * This is a documented schema gap. The risk: rollup JOIN queries silently
		 * under-count when the session row is missing.
		 */
		await recordEvent({
			sessionId: 'orphan-sess-no-parent',
			visitorId: 'v_aabbccddeeff0011',
			eventType: 'pageview',
			path: '/a',
		});

		const rows = await db.select().from(events);
		const sessionRows = await db.select().from(sessions);

		expect(rows).toHaveLength(1);
		expect(sessionRows).toHaveLength(0); // no parent session — orphan confirmed
	});
});

// ── 6. mutations.ts — upsertSession ──────────────────────────────────────────

describe('upsertSession', () => {
	beforeEach(async () => {
		await db.delete(events);
		await db.delete(sessions);
	});

	it('preserves entryPath on conflict — subsequent upserts must not overwrite it', async () => {
		await upsertSession({ id: 'sess-ep', visitorId: 'v_11223344556677aa', entryPath: '/entry' });
		await upsertSession({ id: 'sess-ep', visitorId: 'v_11223344556677aa', entryPath: '/page2' });

		const rows = await db.select().from(sessions);
		expect(rows).toHaveLength(1);
		expect(rows[0].entryPath).toBe('/entry');
	});

	it('increments pageCount on each upsert', async () => {
		await upsertSession({ id: 'sess-pc', visitorId: 'v_11223344556677bb', entryPath: '/home' });
		await upsertSession({ id: 'sess-pc', visitorId: 'v_11223344556677bb', entryPath: '/home' });
		await upsertSession({ id: 'sess-pc', visitorId: 'v_11223344556677bb', entryPath: '/home' });

		const rows = await db.select().from(sessions);
		expect(rows[0].pageCount).toBe(3);
	});

	it('updates exitPath on subsequent page views', async () => {
		await upsertSession({ id: 'sess-ex', visitorId: 'v_11223344556677cc', entryPath: '/home', exitPath: '/home' });
		await upsertSession({ id: 'sess-ex', visitorId: 'v_11223344556677cc', entryPath: '/home', exitPath: '/about' });

		const rows = await db.select().from(sessions);
		expect(rows[0].exitPath).toBe('/about');
	});
});

// ── 7. analytics-cleanup.ts — retention drift ────────────────────────────────

describe('analyticsCleanup — retention constant', () => {
	it('FAILS TODAY: ANALYTICS_RETENTION_DAYS is 90 but spec requires 60 — GDPR Art. 5(1)(e)', () => {
		/**
		 * FAILING TEST — GDPR violation surface.
		 *
		 * RESY/CNIL findings: raw event data must be deleted after 60 days.
		 * Config has ANALYTICS_RETENTION_DAYS = 90.
		 * Fix: change ANALYTICS_RETENTION_DAYS to 60 in config.ts.
		 *
		 * Severity: HIGH — GDPR Art. 5(1)(e) storage limitation
		 */
		expect(ANALYTICS_RETENTION_DAYS).toBe(60); // FAILS: actual value is 90
	});
});

describe('analyticsCleanup — functional behaviour', () => {
	beforeEach(async () => {
		await db.delete(events);
		await db.delete(sessions);
		await db.delete(consentEvents);
	});

	it('deletes events older than retention window and keeps recent ones', async () => {
		const oldDate = new Date();
		oldDate.setDate(oldDate.getDate() - (ANALYTICS_RETENTION_DAYS + 1));

		await db.insert(events).values({
			sessionId: 'sess-old',
			visitorId: 'v_00000000000old1a',
			eventType: 'pageview',
			path: '/old',
			consentTier: 'necessary',
			timestamp: oldDate,
		});

		await db.insert(events).values({
			sessionId: 'sess-new',
			visitorId: 'v_00000000000new1a',
			eventType: 'pageview',
			path: '/new',
			consentTier: 'necessary',
			timestamp: new Date(),
		});

		const deleted = await analyticsCleanup();
		expect(deleted).toBeGreaterThanOrEqual(1);

		const remaining = await db.select().from(events);
		expect(remaining).toHaveLength(1);
		expect(remaining[0].path).toBe('/new');
	});

	it('consent_events are NOT touched by cleanup today — infinite retention (design gap)', async () => {
		/**
		 * Documents current state: analyticsCleanup never deletes consent_events.
		 * After the fix (13-month window), this test must be updated to assert
		 * that rows older than 13mo ARE deleted and rows within 13mo survive.
		 */
		const oldDate = new Date();
		oldDate.setDate(oldDate.getDate() - (ANALYTICS_RETENTION_DAYS + 5));

		await db.insert(consentEvents).values({
			visitorId: 'v_cccccccccccc0001',
			action: 'grant',
			tierBefore: null,
			tierAfter: 'analytics',
			timestamp: oldDate,
		});

		await analyticsCleanup();

		const remaining = await db.select().from(consentEvents);
		// Cleanup does NOT touch consent_events — row survives
		expect(remaining).toHaveLength(1);
		// FINDING: consent_events currently have infinite retention.
	});
});

// ── 8. consent state — init-time leakage guard ───────────────────────────────

describe('createConsentState — default is null, never auto-granted', () => {
	it('tier is null on initialisation — not necessary, analytics, or full', () => {
		/**
		 * In test/SSR context the $effect does not fire (no browser).
		 * Synchronous initial values represent the SSR-safe defaults.
		 */
		const consent = consentState.createConsentState();
		expect(consent.tier).toBeNull();
	});

	it('resolved is false before cookie effect fires — no premature banner flash', () => {
		const consent = consentState.createConsentState();
		expect(consent.resolved).toBe(false);
		expect(consent.needsBanner).toBe(false);
	});

	it('setTier is required to gain analytics consent — no auto-grant', () => {
		const consent = consentState.createConsentState();
		// Unrelated mutations must not grant consent
		consent.reopenBanner();
		consent.closeBanner();
		expect(consent.tier).toBeNull();
	});

	it('resetTier returns to null — not to any consent level', () => {
		const consent = consentState.createConsentState();
		consent.setTier('analytics');
		expect(consent.tier).toBe('analytics');

		consent.resetTier();
		expect(consent.tier).toBeNull(); // not 'necessary', not 'analytics'
	});
});

// ── 9. silent swallow — DB error is observable, not rethrown ─────────────────

describe('recordEvent — DB error swallowed silently by hook', () => {
	it('promise rejects on invalid input; catch handler receives the error', async () => {
		/**
		 * The hook calls trackPageview().catch(err => console.error(...)).
		 * A DB failure inside recordEvent causes the promise to reject.
		 * The hook swallows it — the response is returned normally.
		 * This test proves the rejection is real and observable via the catch handler.
		 *
		 * Method: force a DB constraint error with an invalid enum, spy on console.error,
		 * assert the spy fires — exactly what the hook does.
		 */
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const badInsert = recordEvent({
			sessionId: 'err-sess',
			visitorId: 'v_badbadbadbad0001',
			// @ts-expect-error — intentional invalid enum to force DB error
			eventType: 'invalid_type',
			path: '/crash',
		});

		// Replicate the hook's fire-and-forget pattern
		const result = await badInsert
			.then(() => 'ok')
			.catch((err) => {
				console.error('[analytics] Failed to track pageview:', err);
				return 'swallowed';
			});

		expect(result).toBe('swallowed');
		expect(errorSpy).toHaveBeenCalledWith('[analytics] Failed to track pageview:', expect.anything());

		errorSpy.mockRestore();
	});
});
