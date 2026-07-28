import { describe, expect, it, vi } from 'vitest';

/**
 * The `diag` channel is what makes `mcp.call_log.outcome` fillable. Two properties have to hold,
 * and neither is visible from reading any single file:
 *
 *  1. **Every registry-produced error carries a diag.** Guaranteed by `errorResult`'s required
 *     second parameter, so this suite proves the shape rather than re-proving the type system.
 *
 *  2. **The two transport-built literals carry NONE.** That absence is not incidental — it is the
 *     discriminator. The recorder infers `isError && diag === undefined ⟹ the transport produced
 *     this`, and that inference is only sound while these two literals stay bare. If someone
 *     "helpfully" adds a diag to them, every unknown-tool and every thrown-tool row would silently
 *     reclassify as a handler error, and `tool_error` — the meter that reports uninstrumented call
 *     sites — would stop meaning anything.
 *
 * Mocked because importing the admin registry otherwise constructs a real Neon pool at module load.
 */
vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/admin/audit', () => ({ recordAuditEvent: vi.fn(), queryAuditLog: vi.fn() }));

const { handleMcpMessage } = await import('./transport');
const { publicPatternRegistry } = await import('./patterns/registry');
const { readAllowlistedExcerpt } = await import('./patterns/excerpts');

const IDENTITY = { name: 'test', version: '0.0.1', instructions: 'test server' };

/** Dispatch straight through the registry, bypassing the transport's own literals. */
async function callTool(name: string, args: Record<string, unknown> = {}) {
	return await publicPatternRegistry.dispatch(name, args);
}

describe('tool diag — every registry error is classified', () => {
	it('classifies a genuine no-match as `empty` (the capability-gap signal)', async () => {
		// Deliberately realistic "capability we do not cover" queries rather than gibberish. Note
		// that scoring prefix-matches at half weight (search.ts), so a query containing registry
		// meta-vocabulary — the literal word "capability", say — scores a weak hit and is NOT a
		// no-match. Fixtures here must be domain terms that appear nowhere in the registry.
		for (const [tool, args] of [
			['search_patterns', { query: 'stripe subscription webhooks' }],
			['trace_capability', { capability: 'kubernetes operator' }],
			['recommend_emulation_plan', { capabilities: ['blockchain wallet'] }],
		] as const) {
			const result = await callTool(tool, args);
			expect(result.isError, `${tool} should have found nothing`).toBe(true);
			expect(result.diag, `${tool} no-match must be 'empty'`).toBe('empty');
		}
	});

	it('classifies an unknown category filter as `invalid_args`, NOT `empty`', async () => {
		// This is the trap: it reuses the no-match help text, but the query never ran. Recording it
		// as `empty` would fill the capability-gaps report with typo'd filter names rather than with
		// capabilities anyone actually wanted.
		const result = await callTool('search_patterns', { query: 'rag', category: 'no-such-category' });
		expect(result.isError).toBe(true);
		expect(result.diag).toBe('invalid_args');
	});

	it('classifies malformed arguments as `invalid_args`', async () => {
		for (const [tool, args] of [
			['search_patterns', { query: '   ' }],
			['trace_capability', { capability: '' }],
			['recommend_emulation_plan', { capabilities: [] }],
		] as const) {
			const result = await callTool(tool, args);
			expect(result.isError, `${tool} should have rejected the arguments`).toBe(true);
			expect(result.diag, `${tool} bad args must be 'invalid_args'`).toBe('invalid_args');
		}
	});

	it('classifies a real-shaped id we do not have as `not_found` (a registry gap)', async () => {
		const result = await callTool('get_pattern', { id: 'no-such-pattern-id' });
		expect(result.isError).toBe(true);
		expect(result.diag).toBe('not_found');
	});

	it('classifies a non-allowlisted excerpt path as `not_found`', async () => {
		const result = await callTool('get_file_excerpt', { path: 'src/lib/server/auth/guards.ts' });
		expect(result.isError).toBe(true);
		expect(result.diag).toBe('not_found');
	});

	it('classifies the registry dispatch fallback as `unknown_tool`', async () => {
		const result = await callTool('no_such_tool');
		expect(result.isError).toBe(true);
		expect(result.diag).toBe('unknown_tool');
	});

	it('carries no diag on success', async () => {
		const result = await callTool('search_patterns', { query: 'rag' });
		expect(result.isError).toBeUndefined();
		expect(result.diag).toBeUndefined();
	});
});

describe('excerpt failures forward a reason rather than defaulting to one', () => {
	it('distinguishes bad input from a missing allowlist entry', () => {
		expect(readAllowlistedExcerpt('')).toMatchObject({ ok: false, diag: 'invalid_args' });
		expect(readAllowlistedExcerpt('/etc/passwd')).toMatchObject({ ok: false, diag: 'invalid_args' });
		expect(readAllowlistedExcerpt('src/lib/server/auth/guards.ts')).toMatchObject({
			ok: false,
			diag: 'not_found',
		});
	});
});

describe('transport-built errors stay bare — this absence IS the discriminator', () => {
	it('emits no diag for an unknown tool name', async () => {
		const response = await handleMcpMessage(
			{ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'not_in_this_registry' } },
			publicPatternRegistry,
			IDENTITY,
		);
		const result = (response as { result: { isError?: boolean; diag?: string } }).result;
		expect(result.isError).toBe(true);
		expect(result.diag).toBeUndefined();
	});

	it('emits no diag when a tool throws', async () => {
		const throwingRegistry = {
			tools: [{ name: 'boom', description: 'boom', inputSchema: { type: 'object' } }],
			dispatch: () => {
				throw new Error('boom');
			},
		};
		const response = await handleMcpMessage(
			{ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'boom' } },
			throwingRegistry,
			IDENTITY,
		);
		const result = (response as { result: { isError?: boolean; diag?: string } }).result;
		expect(result.isError).toBe(true);
		expect(result.diag).toBeUndefined();
	});
});
