import { describe, expect, it, vi } from 'vitest';
import { mcpCallLog } from '$lib/server/db/schema/mcp/call-log';
import { createTestDb } from '$lib/server/test/db';
import type { McpCallObservation } from '../types';

/**
 * Producer-satisfies-constraints for the PRIVATE surface — the 2026-07-28-shaped test.
 *
 * The schema tests prove the table rejects bad rows; the observer tests prove the builder
 * produces the intended values. Neither proves the two AGREE — and that exact gap once dropped
 * every admin row in production for an hour (two individually-correct halves of one invariant,
 * no test spanning them, a writer that fails open). Here the REAL `buildCallLogRow` output is
 * inserted through the REAL schema.
 *
 * `$lib/server/db` is mocked only to stop the import graph constructing a Neon pool — the
 * inserts below go to a fresh PGlite database from `createTestDb()`.
 */
vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { buildCallLogRow } = await import('./observer');

const NOW = new Date('2026-08-03T00:00:00Z');

function observation(over: Partial<McpCallObservation> = {}): McpCallObservation {
	return {
		method: 'tools/call',
		toolName: 'search_patterns',
		diag: null,
		isError: false,
		stage: 'tool',
		status: 200,
		rpcErrorCode: null,
		clientName: null,
		clientVersion: null,
		requestedProtocolVersion: null,
		servedProtocolVersion: null,
		toolCount: null,
		args: { query: 'background jobs' },
		responseText: '# Match\n\nUse the jobs pattern.',
		handleMs: 1,
		...over,
	};
}

const context = {
	surface: 'private' as const,
	ip: '203.0.113.7',
	// A real MCP client UA and the workspace header — the shape densho actually sends.
	headers: new Headers({ 'user-agent': 'claude-code/2.1.89 (cli)', 'x-v10r-workspace': 'densho' }),
	gateMs: 12,
	registryVersion: '1.0.0',
	knownTool: (name: string) => name === 'search_patterns',
	body: undefined,
};

describe('the private producer satisfies the constraints', () => {
	it('a successful private call — query, answer and workspace all kept — inserts cleanly', async () => {
		const { db } = await createTestDb();
		const row = buildCallLogRow(observation(), context, NOW);
		// The salt is unset in this test env, so clientKey is null — the fail-open column, not row.
		expect(row.clientKey).toBeNull();
		const [inserted] = await db.insert(mcpCallLog).values(row).returning();
		expect(inserted).toMatchObject({
			surface: 'private',
			queryText: 'background jobs',
			responseText: '# Match\n\nUse the jobs pattern.',
			workspace: 'densho',
		});
		expect(inserted.traffic).not.toBe('external');
	});

	it('a private miss and a protocol row insert cleanly too', async () => {
		const { db } = await createTestDb();
		const miss = buildCallLogRow(observation({ isError: true, diag: 'empty' }), context, NOW);
		await expect(db.insert(mcpCallLog).values(miss)).resolves.toBeDefined();

		const protocol = buildCallLogRow(
			observation({ method: 'tools/list', toolName: null, stage: 'protocol', args: undefined, responseText: null }),
			context,
			NOW,
		);
		await expect(db.insert(mcpCallLog).values(protocol)).resolves.toBeDefined();
	});

	it('an oversized answer is capped by the builder BEFORE the CHECK would fire', async () => {
		const { db } = await createTestDb();
		const row = buildCallLogRow(observation({ responseText: `prose ${'word '.repeat(2000)}` }), context, NOW);
		expect(row.responseText).toHaveLength(4000);
		await expect(db.insert(mcpCallLog).values(row)).resolves.toBeDefined();
	});
});
