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
import { adminAuditLog } from '$lib/server/db/schema/admin';
import { conversation, message } from '$lib/server/db/schema/ai/conversation';
import { modelCall, toolCall, turn } from '$lib/server/db/schema/ai/turn';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { file, fileRevision } from '$lib/server/db/schema/desk';
import { mcpCallLog } from '$lib/server/db/schema/mcp/call-log';
import { retentionDays } from '$lib/server/retention';

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
				deletedAt: daysAgo(retentionDays('desk-trash') + 10),
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
				createdAt: daysAgo(retentionDays('desk-revisions') + 10),
			},
		]);

		await deskRetention();

		const ids = (await db.select({ id: fileRevision.id }).from(fileRevision)).map((r) => r.id);
		expect(ids).toEqual(['drv_recent']); // old pruned, recent kept
	});
});

// ai-telemetry-retention: redact bodies, then age-cap rows; parents untouched

describe('aiTelemetryRetention — redacts turn bodies at 30 d, deletes rows at 180 d, leaves conversation/message', () => {
	const turnRow = (messageId: string, createdAt: Date) => ({
		messageId,
		conversationId: 'conv_1',
		userId: USER_ID,
		surface: 'chatbot' as const,
		requestId: `req_${messageId}`,
		profileVersion: 'sys:1',
		outcome: 'ok' as const,
		timings: {},
		awareness: { locale: 'en', authCeiling: null },
		activations: [],
		blocks: [{ id: 'role' as const, section: 'identity' as const, text: 'You are Vely.', chars: 13, stable: true }],
		grounding: [],
		history: { messages: [], droppedMessages: 0 },
		toolset: [],
		attempts: [],
		citations: [],
		createdAt,
	});

	it('nulls the bodies past the redact window, deletes past the row window, never touches the parent rows', async () => {
		await db.insert(conversation).values({ id: 'conv_1', userId: USER_ID, title: 'T' });
		await db.insert(message).values([
			{ id: 'msg_recent', conversationId: 'conv_1', role: 'assistant', content: 'a' },
			{ id: 'msg_aged', conversationId: 'conv_1', role: 'assistant', content: 'b' },
			{ id: 'msg_old', conversationId: 'conv_1', role: 'assistant', content: 'c' },
		]);
		const aged = daysAgo(retentionDays('ai-turn-bodies') + 10);
		const old = daysAgo(retentionDays('ai-turns') + 10);
		await db
			.insert(turn)
			.values([turnRow('msg_recent', daysAgo(1)), turnRow('msg_aged', aged), turnRow('msg_old', old)]);
		const request = { systemHash: 'sys:1', blockIds: ['role' as const], historyCount: 1, toolsOffered: [] };
		await db.insert(modelCall).values([
			{
				id: 'mcl_recent',
				conversationId: 'conv_1',
				messageId: 'msg_recent',
				stepIndex: 0,
				request,
				createdAt: daysAgo(1),
			},
			{ id: 'mcl_aged', conversationId: 'conv_1', messageId: 'msg_aged', stepIndex: 0, request, createdAt: aged },
			{ id: 'mcl_old', conversationId: 'conv_1', messageId: 'msg_old', stepIndex: 0, request, createdAt: old },
		]);
		await db.insert(toolCall).values([
			{
				id: 'tcl_aged',
				messageId: 'msg_aged',
				toolCallId: 'call_1',
				toolName: 'search_catalog',
				args: {},
				result: { rows: 1 },
				status: 'success',
				createdAt: aged,
			},
			{
				id: 'tcl_old',
				messageId: 'msg_old',
				toolCallId: 'call_2',
				toolName: 'search_catalog',
				args: {},
				result: { rows: 1 },
				status: 'success',
				createdAt: old,
			},
		]);

		const affected = await aiTelemetryRetention();

		// 2 turns scrubbed (aged + old, both past the redact window) + 1 tool call + 1 model call + 1 turn deleted.
		expect(affected).toBe(5);
		const turns = await db.select().from(turn).orderBy(turn.messageId);
		expect(turns.map((t) => t.messageId)).toEqual(['msg_aged', 'msg_recent']);
		const agedTurn = turns.find((t) => t.messageId === 'msg_aged');
		expect(agedTurn?.blocks).toBeNull();
		expect(agedTurn?.history).toBeNull();
		expect(agedTurn?.redactedAt).not.toBeNull();
		// The outline survives the redact pass.
		expect(agedTurn?.outcome).toBe('ok');
		expect(turns.find((t) => t.messageId === 'msg_recent')?.blocks).toHaveLength(1);
		const calls = await db.select().from(modelCall).orderBy(modelCall.id);
		expect(calls.map((c) => c.id)).toEqual(['mcl_aged', 'mcl_recent']);
		expect(calls.find((c) => c.id === 'mcl_aged')?.request).toBeNull();
		expect(calls.find((c) => c.id === 'mcl_recent')?.request).toEqual(request);
		const tools = await db.select().from(toolCall);
		expect(tools.map((t) => t.id)).toEqual(['tcl_aged']);
		expect(tools[0]?.result).toBeNull();
		expect(await db.select().from(conversation)).toHaveLength(1);
		expect(await db.select().from(message)).toHaveLength(3);
	});

	it('is idempotent: a second run over a scrubbed window affects nothing', async () => {
		await db.insert(conversation).values({ id: 'conv_1', userId: USER_ID, title: 'T' });
		await db.insert(message).values({ id: 'msg_aged', conversationId: 'conv_1', role: 'assistant', content: 'b' });
		await db.insert(turn).values(turnRow('msg_aged', daysAgo(retentionDays('ai-turn-bodies') + 10)));
		expect(await aiTelemetryRetention()).toBe(1);
		expect(await aiTelemetryRetention()).toBe(0);
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
				occurredAt: daysAgo(retentionDays('admin-audit-log') + 10),
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
		await db.insert(mcpCallLog).values(callRow(daysAgo(retentionDays('mcp-call-text') + 1)));

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
		await db.insert(mcpCallLog).values(callRow(daysAgo(retentionDays('mcp-call-text') - 1)));
		await mcpTelemetryRetention();
		const [row] = await db.select().from(mcpCallLog);
		expect(row.queryText).toBe('kubernetes operator');
		expect(row.traceId).not.toBeNull();
	});

	it('deletes the row itself at the long window', async () => {
		await db
			.insert(mcpCallLog)
			.values([
				callRow(daysAgo(retentionDays('mcp-call-log') + 1)),
				callRow(daysAgo(retentionDays('mcp-call-log') - 1)),
			]);

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
				callRow(daysAgo(retentionDays('mcp-call-text') + 1)),
				callRow(daysAgo(retentionDays('mcp-call-log') + 1)),
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
				privateRow(daysAgo(retentionDays('mcp-call-text') + 1)),
				callRow(daysAgo(retentionDays('mcp-call-text') + 1)),
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
				privateRow(daysAgo(retentionDays('mcp-call-log') + 1)),
				privateRow(daysAgo(retentionDays('mcp-call-log') - 1)),
			]);
		await mcpTelemetryRetention();
		const rows = await db.select().from(mcpCallLog);
		expect(rows).toHaveLength(1);
	});

	it('stays idempotent with an old private row present — it is skipped, not re-counted', async () => {
		await db.insert(mcpCallLog).values(privateRow(daysAgo(retentionDays('mcp-call-text') + 1)));
		expect(await mcpTelemetryRetention()).toBe(0);
		expect(await mcpTelemetryRetention()).toBe(0);
	});
});
