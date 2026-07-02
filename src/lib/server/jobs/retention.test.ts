/**
 * Retention hard-delete safety — the three cron sweeps that PERMANENTLY delete rows.
 *
 * The load-bearing guarantee: a LIVE desk file (`deleted_at IS NULL`) is NEVER deleted —
 * only soft-deleted-AND-expired rows are. A dropped `isNotNull(deletedAt)` predicate would
 * wipe every live desk on the next cron; the first test pins exactly that. The telemetry
 * and audit sweeps are plain age-caps — old rows go, recent rows stay, parents untouched.
 *
 * Real PGlite (not mocks) so the actual SQL predicate + NULL comparison semantics are exercised.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	AI_TELEMETRY_RETENTION_DAYS,
	AUDIT_RETENTION_DAYS,
	DESK_REVISION_RETENTION_DAYS,
	DESK_SOFT_DELETE_RETENTION_DAYS,
} from '$lib/server/config';
import { adminAuditLog } from '$lib/server/db/schema/admin';
import { conversation, conversationStep, message } from '$lib/server/db/schema/ai/conversation';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { file, fileRevision } from '$lib/server/db/schema/desk';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { db } = await import('$lib/server/db');
const { deskRetention } = await import('./desk-retention');
const { aiTelemetryRetention } = await import('./ai-telemetry-retention');
const { auditLogRetention } = await import('./audit-log-retention');

afterAll(async () => {
	await testClient?.close();
});

const USER_ID = 'usr_retention_test';

function daysAgo(n: number): Date {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d;
}

beforeEach(async () => {
	await db.delete(adminAuditLog);
	await db.delete(user); // cascades desk file + file_revision + conversation → message → step
	await db.insert(user).values({ id: USER_ID, name: 'Retention Tester', email: 'retention@example.com' });
});

// ── desk-retention: the destructive one ──────────────────────────────────────

describe('deskRetention — never touches a live file', () => {
	it('keeps a live file (deletedAt NULL) and a recently-trashed one; deletes only the expired soft-delete', async () => {
		await db.insert(file).values([
			{
				id: 'f_live',
				userId: USER_ID,
				type: 'markdown',
				name: 'Live',
				deletedAt: null,
			},
			{
				id: 'f_recent',
				userId: USER_ID,
				type: 'markdown',
				name: 'Recent',
				deletedAt: daysAgo(1),
			},
			{
				id: 'f_expired',
				userId: USER_ID,
				type: 'markdown',
				name: 'Expired',
				deletedAt: daysAgo(DESK_SOFT_DELETE_RETENTION_DAYS + 10),
			},
		]);

		const deleted = await deskRetention();

		const remaining = (await db.select({ id: file.id }).from(file)).map((r) => r.id).sort();
		expect(remaining).toEqual(['f_live', 'f_recent']); // expired gone; live + recent stay
		expect(deleted).toBe(1);
	});

	it('an ANCIENT live file (created long ago, never soft-deleted) survives — NULL deletedAt can never match', async () => {
		await db.insert(file).values({
			id: 'f_old_live',
			userId: USER_ID,
			type: 'spreadsheet',
			name: 'Ancient Live',
			deletedAt: null,
			createdAt: daysAgo(400),
			updatedAt: daysAgo(400),
		});

		await deskRetention();

		const ids = (await db.select({ id: file.id }).from(file)).map((r) => r.id);
		expect(ids).toContain('f_old_live');
	});

	it('prunes file_revision purely by age, independent of any file row', async () => {
		await db.insert(fileRevision).values([
			{
				id: 'drv_recent',
				fileId: 'f_x',
				userId: USER_ID,
				fileType: 'markdown',
				reason: 'delete',
				createdAt: daysAgo(1),
			},
			{
				id: 'drv_old',
				fileId: 'f_x',
				userId: USER_ID,
				fileType: 'markdown',
				reason: 'overwrite',
				createdAt: daysAgo(DESK_REVISION_RETENTION_DAYS + 10),
			},
		]);

		await deskRetention();

		const ids = (await db.select({ id: fileRevision.id }).from(fileRevision)).map((r) => r.id);
		expect(ids).toEqual(['drv_recent']); // old pruned, recent kept
	});
});

// ── ai-telemetry-retention: age-cap, parents untouched ────────────────────────

describe('aiTelemetryRetention — age-caps conversation_step, leaves conversation/message', () => {
	it('deletes steps past the window, keeps recent, and never touches the parent rows', async () => {
		await db.insert(conversation).values({ id: 'conv_1', userId: USER_ID, title: 'T' });
		await db.insert(message).values({ id: 'msg_1', conversationId: 'conv_1', role: 'user', content: 'hi' });
		await db.insert(conversationStep).values([
			{
				id: 'step_recent',
				conversationId: 'conv_1',
				messageId: 'msg_1',
				stepIndex: 0,
				stepType: 'initial',
				createdAt: daysAgo(1),
			},
			{
				id: 'step_old',
				conversationId: 'conv_1',
				messageId: 'msg_1',
				stepIndex: 1,
				stepType: 'initial',
				createdAt: daysAgo(AI_TELEMETRY_RETENTION_DAYS + 10),
			},
		]);

		const deleted = await aiTelemetryRetention();

		expect(deleted).toBe(1);
		const steps = (await db.select({ id: conversationStep.id }).from(conversationStep)).map((r) => r.id);
		expect(steps).toEqual(['step_recent']);
		expect(await db.select().from(conversation)).toHaveLength(1);
		expect(await db.select().from(message)).toHaveLength(1);
	});
});

// ── audit-log-retention: age-cap ──────────────────────────────────────────────

describe('auditLogRetention — age-caps admin.audit_log', () => {
	it('deletes rows past the window and keeps recent ones', async () => {
		await db.insert(adminAuditLog).values([
			{
				action: 'flag.toggle',
				actorId: 'admin1',
				actorEmail: 'a@x.io',
				occurredAt: daysAgo(1),
			},
			{
				action: 'user.ban',
				actorId: 'admin1',
				actorEmail: 'a@x.io',
				occurredAt: daysAgo(AUDIT_RETENTION_DAYS + 10),
			},
		]);

		const deleted = await auditLogRetention();

		expect(deleted).toBe(1);
		const actions = (await db.select({ action: adminAuditLog.action }).from(adminAuditLog)).map((r) => r.action);
		expect(actions).toEqual(['flag.toggle']);
	});
});
