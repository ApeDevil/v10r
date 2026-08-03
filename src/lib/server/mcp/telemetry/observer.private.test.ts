import { describe, expect, it, vi } from 'vitest';
import type { McpCallObservation } from '../types';

/**
 * The private lane's capture policy, tested on the REAL row builder: query text on every
 * outcome (private only), answer text (private + tool stage only, capped), the workspace
 * label (validate-or-drop), and traffic that can never be 'external'.
 *
 * Mocked edges keep the database and the Vercel platform out of the module graph; the row
 * builder itself is the real production code.
 */
vi.mock('./writer', () => ({ writeCallLog: vi.fn() }));
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

function context(surface: 'public' | 'admin' | 'private', headers = new Headers({ 'user-agent': 'test' })) {
	return {
		surface,
		ip: '203.0.113.7',
		headers,
		gateMs: 1,
		registryVersion: '1.0.0',
		knownTool: (name: string) => name === 'search_patterns',
		body: undefined,
	};
}

describe('private-lane query capture', () => {
	it('keeps the question on a SUCCESSFUL private call — the exact row public discards', () => {
		const privateRow = buildCallLogRow(observation(), context('private'), NOW);
		expect(privateRow.outcome).toBe('ok');
		expect(privateRow.queryText).toBe('background jobs');

		const publicRow = buildCallLogRow(observation(), context('public'), NOW);
		expect(publicRow.outcome).toBe('ok');
		expect(publicRow.queryText).toBeNull();
	});

	it('still keeps the question on a private miss, like public does', () => {
		const row = buildCallLogRow(observation({ isError: true, diag: 'empty' }), context('private'), NOW);
		expect(row.outcome).toBe('empty');
		expect(row.queryText).toBe('background jobs');
	});
});

describe('private-lane answer capture', () => {
	it('keeps the scrubbed answer on a private tool call and nowhere else', () => {
		expect(buildCallLogRow(observation(), context('private'), NOW).responseText).toBe(
			'# Match\n\nUse the jobs pattern.',
		);
		expect(buildCallLogRow(observation(), context('public'), NOW).responseText).toBeNull();
		expect(buildCallLogRow(observation(), context('admin'), NOW).responseText).toBeNull();
	});

	it('drops the answer on a protocol-stage row even on the private surface', () => {
		const row = buildCallLogRow(
			observation({ method: 'tools/list', toolName: null, stage: 'protocol', args: undefined }),
			context('private'),
			NOW,
		);
		expect(row.stage).toBe('protocol');
		expect(row.responseText).toBeNull();
	});

	it('caps the stored answer at 4000 chars (the DB CHECK ceiling)', () => {
		const row = buildCallLogRow(
			observation({ responseText: `prose ${'word '.repeat(2000)}` }),
			context('private'),
			NOW,
		);
		expect(row.responseText).toHaveLength(4000);
	});
});

describe('workspace label', () => {
	const withWorkspace = (value: string) => new Headers({ 'user-agent': 'test', 'x-v10r-workspace': value });

	it('captures a valid label, lowercased, on the private surface only', () => {
		expect(buildCallLogRow(observation(), context('private', withWorkspace('densho')), NOW).workspace).toBe('densho');
		expect(buildCallLogRow(observation(), context('private', withWorkspace('Densho')), NOW).workspace).toBe('densho');
		expect(buildCallLogRow(observation(), context('public', withWorkspace('densho')), NOW).workspace).toBeNull();
	});

	it('DROPS an invalid label rather than coercing it to a sentinel', () => {
		for (const bad of ['not a workspace', '-leading-dash', 'under_score', 'x'.repeat(33), '']) {
			expect(buildCallLogRow(observation(), context('private', withWorkspace(bad)), NOW).workspace, bad).toBeNull();
		}
	});

	it('is null when the header is absent', () => {
		expect(buildCallLogRow(observation(), context('private'), NOW).workspace).toBeNull();
	});
});

describe('private-lane traffic', () => {
	it('is never external, for any client shape', () => {
		for (const ua of ['claude-code/2.1.89 (cli)', 'curl/8.4.0', 'Mozilla/5.0']) {
			const row = buildCallLogRow(observation(), context('private', new Headers({ 'user-agent': ua })), NOW);
			expect(row.traffic, ua).not.toBe('external');
		}
	});
});
