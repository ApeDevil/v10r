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
	MCP_QUERY_TEXT_RETENTION_DAYS,
	MCP_TELEMETRY_RETENTION_DAYS,
} from '$lib/server/config';
import { adminAuditLog } from '$lib/server/db/schema/admin';
import { conversation, conversationStep, message } from '$lib/server/db/schema/ai/conversation';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { file, fileRevision } from '$lib/server/db/schema/desk';
import { mcpCallLog } from '$lib/server/db/schema/mcp/call-log';

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
const { mcpTelemetryRetention } = await import('./mcp-telemetry-retention');

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
	await db.delete(mcpCallLog);
	await db.delete(user); // cascades desk file + file_revision + conversation → message → step
	await db.insert(user).values({ id: USER_ID, name: 'Retention Tester', email: 'retention@example.com' });
});

// desk-retention: the destructive one

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

// ai-telemetry-retention: age-cap, parents untouched

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

// audit-log-retention: age-cap

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

// mcp-telemetry-retention: two speeds, column before row

describe('mcpTelemetryRetention — minimises by column before minimising by row', () => {
	/** A tool row that still carries both caller-supplied values. */
	function callRow(startedAt: Date) {
		return {
			surface: 'public' as const,
			traffic: 'external' as const,
			stage: 'tool' as const,
			outcome: 'empty' as const,
			method: 'tools/call' as const,
			toolName: 'search_patterns',
			queryText: 'kubernetes operator',
			traceId: '0af7651916cd43dd8448eb211c80319c',
			clientFamily: 'claude-code',
			registryVersion: '1.0.0',
			totalMs: 10,
			gateMs: 8,
			dispatchMs: 1,
			startedAt,
		};
	}

	it('nulls caller-supplied text at the short window while KEEPING the dimensional signal', async () => {
		await db.insert(mcpCallLog).values(callRow(daysAgo(MCP_QUERY_TEXT_RETENTION_DAYS + 1)));

		await mcpTelemetryRetention();

		const [row] = await db.select().from(mcpCallLog);
		// The two columns that could describe a third party are gone...
		expect(row.queryText).toBeNull();
		expect(row.traceId).toBeNull();
		// ...while everything that makes "did the miss rate drop after v1.3?" answerable survives.
		expect(row.outcome).toBe('empty');
		expect(row.toolName).toBe('search_patterns');
		expect(row.registryVersion).toBe('1.0.0');
		expect(row.gateMs).toBe(8);
	});

	it('leaves a row inside the short window completely untouched', async () => {
		await db.insert(mcpCallLog).values(callRow(daysAgo(MCP_QUERY_TEXT_RETENTION_DAYS - 1)));
		await mcpTelemetryRetention();
		const [row] = await db.select().from(mcpCallLog);
		expect(row.queryText).toBe('kubernetes operator');
		expect(row.traceId).not.toBeNull();
	});

	it('deletes the row itself at the long window', async () => {
		await db
			.insert(mcpCallLog)
			.values([callRow(daysAgo(MCP_TELEMETRY_RETENTION_DAYS + 1)), callRow(daysAgo(MCP_TELEMETRY_RETENTION_DAYS - 1))]);

		await mcpTelemetryRetention();

		const rows = await db.select().from(mcpCallLog);
		expect(rows).toHaveLength(1);
	});

	it('is idempotent, so cron jitter and a missed week cannot corrupt it', async () => {
		// Both passes use absolute-age predicates rather than a since-last-run window. That is the
		// property that makes Vercel's ±59min jitter irrelevant and a skipped week self-repairing —
		// and it is only observable by running the job twice.
		await db
			.insert(mcpCallLog)
			.values([
				callRow(daysAgo(MCP_QUERY_TEXT_RETENTION_DAYS + 1)),
				callRow(daysAgo(MCP_TELEMETRY_RETENTION_DAYS + 1)),
			]);

		const first = await mcpTelemetryRetention();
		const after = await db.select().from(mcpCallLog);
		const second = await mcpTelemetryRetention();

		expect(first).toBeGreaterThan(0);
		// Nothing left to do, and crucially nothing re-scrubbed: the second pass reports zero rather
		// than rewriting the already-clean range.
		expect(second).toBe(0);
		expect(await db.select().from(mcpCallLog)).toHaveLength(after.length);
	});

	/** A private-lane row — the surface whose text is exempt from pass 1. */
	function privateRow(startedAt: Date) {
		return {
			...callRow(startedAt),
			surface: 'private' as const,
			traffic: 'self' as const,
			outcome: 'ok' as const,
			responseText: '# Answer',
			workspace: 'densho',
		};
	}

	it('EXEMPTS private rows from pass 1 — their text is the analysis corpus', async () => {
		await db
			.insert(mcpCallLog)
			.values([
				privateRow(daysAgo(MCP_QUERY_TEXT_RETENTION_DAYS + 1)),
				callRow(daysAgo(MCP_QUERY_TEXT_RETENTION_DAYS + 1)),
			]);

		await mcpTelemetryRetention();

		const rows = await db.select().from(mcpCallLog);
		const privateRowAfter = rows.find((r) => r.surface === 'private');
		const publicRowAfter = rows.find((r) => r.surface === 'public');
		// Private keeps everything (including trace_id — a documented, intentional widening)...
		expect(privateRowAfter?.queryText).toBe('kubernetes operator');
		expect(privateRowAfter?.responseText).toBe('# Answer');
		expect(privateRowAfter?.traceId).not.toBeNull();
		// ...while the public row alongside it is still nulled — the regression guard on the `ne`.
		expect(publicRowAfter?.queryText).toBeNull();
		expect(publicRowAfter?.traceId).toBeNull();
	});

	it('still deletes private rows whole at the long window', async () => {
		await db
			.insert(mcpCallLog)
			.values([
				privateRow(daysAgo(MCP_TELEMETRY_RETENTION_DAYS + 1)),
				privateRow(daysAgo(MCP_TELEMETRY_RETENTION_DAYS - 1)),
			]);
		await mcpTelemetryRetention();
		const rows = await db.select().from(mcpCallLog);
		expect(rows).toHaveLength(1);
	});

	it('stays idempotent with an old private row present — it is skipped, not re-counted', async () => {
		await db.insert(mcpCallLog).values(privateRow(daysAgo(MCP_QUERY_TEXT_RETENTION_DAYS + 1)));
		expect(await mcpTelemetryRetention()).toBe(0);
		expect(await mcpTelemetryRetention()).toBe(0);
	});
});
