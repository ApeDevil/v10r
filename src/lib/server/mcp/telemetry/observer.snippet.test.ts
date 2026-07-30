import { describe, expect, it, vi } from 'vitest';
import type { McpCallObservation } from '../types';

/**
 * validate_snippet privacy regression: a submitted snippet must NEVER reach a call-log
 * row. Three independent barriers exist — the arg is named `snippet` (extractQuery reads
 * only query/capability/capabilities), the tool never returns `empty`, and queryText is
 * gated on outcome === 'empty' — and this test forces the WORST case (a forged `empty`
 * on the public surface) to prove the protection is the key allowlist itself, not merely
 * the fact that the tool never takes the no-match path.
 *
 * Mocked edges keep the database and the Vercel platform out of the module graph; the
 * row builder itself is the real production code.
 */
vi.mock('./writer', () => ({ writeCallLog: vi.fn() }));
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { buildCallLogRow } = await import('./observer');

function observation(over: Partial<McpCallObservation> = {}): McpCallObservation {
	return {
		method: 'tools/call',
		toolName: 'validate_snippet',
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
		args: undefined,
		handleMs: 1,
		...over,
	};
}

const CONTEXT = {
	surface: 'public' as const,
	ip: '203.0.113.7',
	headers: new Headers({ 'user-agent': 'test' }),
	gateMs: 1,
	registryVersion: '1.0.0',
	knownTool: (name: string) => name === 'validate_snippet',
	body: undefined,
};

describe('buildCallLogRow never records a submitted snippet', () => {
	it('drops the snippet even on a forged worst-case empty outcome', () => {
		const row = buildCallLogRow(
			observation({
				isError: true,
				diag: 'empty',
				args: { snippet: 'SECRET_MARKER_do_not_persist', language: 'svelte' },
			}),
			CONTEXT,
			new Date('2026-07-30T00:00:00Z'),
		);
		expect(row.outcome).toBe('empty');
		expect(row.queryText).toBeNull();
		expect(JSON.stringify(row)).not.toContain('SECRET_MARKER');
	});

	it('records nothing snippet-shaped on the normal success path either', () => {
		const row = buildCallLogRow(
			observation({ args: { snippet: 'SECRET_MARKER_do_not_persist' } }),
			CONTEXT,
			new Date('2026-07-30T00:00:00Z'),
		);
		expect(row.queryText).toBeNull();
		expect(JSON.stringify(row)).not.toContain('SECRET_MARKER');
	});
});
