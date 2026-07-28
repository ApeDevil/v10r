import { describe, expect, it } from 'vitest';
import type { McpCallObservation } from '../types';
import { inferOutcome, normalizeMethod } from './outcome';
import { normalizeQueryText, scrubSecrets } from './scrub';
import { classifyClientFamily, classifyTraffic } from './self-traffic';
import { parseTraceparent, resolveTraceId } from './traceparent';

/** The pure half of the telemetry pipeline: no database, no platform, no mocks. */

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
		args: undefined,
		handleMs: 1,
		...over,
	};
}

const knownTool = (name: string) => name === 'search_patterns';

describe('inferOutcome', () => {
	it('maps each diag onto its own outcome', () => {
		for (const [diag, expected] of [
			['empty', 'empty'],
			['invalid_args', 'invalid_args'],
			['not_found', 'not_found'],
			['snapshot_miss', 'snapshot_miss'],
			['conflict', 'conflict'],
			['unknown_tool', 'unknown_tool'],
		] as const) {
			expect(inferOutcome(observation({ isError: true, diag }), knownTool)).toEqual({
				stage: 'tool',
				outcome: expected,
			});
		}
	});

	it('reads the ABSENCE of a diag as a transport-built error', () => {
		// This pair is the whole point of the required-diag rule. An unknown name never reached a
		// handler; a known name that errored without a diag must have thrown inside one.
		expect(inferOutcome(observation({ isError: true, diag: null, toolName: 'nope' }), knownTool)).toEqual({
			stage: 'tool',
			outcome: 'unknown_tool',
		});
		expect(inferOutcome(observation({ isError: true, diag: null, toolName: 'search_patterns' }), knownTool)).toEqual({
			stage: 'tool',
			outcome: 'threw',
		});
	});

	it('classifies pre-dispatch failures by how they failed', () => {
		const envelope = (over: Partial<McpCallObservation>) =>
			inferOutcome(observation({ stage: 'envelope', isError: true, ...over }), knownTool).outcome;
		expect(envelope({ status: 403 })).toBe('forbidden_origin');
		expect(envelope({ status: 400, rpcErrorCode: -32700 })).toBe('parse_error');
		expect(envelope({ status: 400, rpcErrorCode: null })).toBe('unsupported_version');
		expect(envelope({ status: 200, rpcErrorCode: -32600 })).toBe('bad_envelope');
		expect(envelope({ status: 500 })).toBe('internal_error');
	});

	it('surfaces an unimplemented method as its own outcome, not as noise', () => {
		// A spec-compliant client probing resources/list is telling you it expected a capability you
		// do not expose — a feature request, not a protocol error.
		expect(
			inferOutcome(observation({ stage: 'protocol', method: 'resources/list', rpcErrorCode: -32601 }), knownTool),
		).toEqual({ stage: 'protocol', outcome: 'unknown_method' });
	});

	it('treats a successful protocol call as ok', () => {
		expect(inferOutcome(observation({ stage: 'protocol', method: 'initialize' }), knownTool).outcome).toBe('ok');
	});
});

describe('normalizeMethod', () => {
	it('bounds caller-controlled method names to a fixed domain', () => {
		expect(normalizeMethod('tools/call')).toBe('tools/call');
		expect(normalizeMethod('server/discover')).toBe('server/discover');
		expect(normalizeMethod('resources/list')).toBe('other');
		expect(normalizeMethod('x'.repeat(5000))).toBe('other');
		expect(normalizeMethod(null)).toBeNull();
	});
});

describe('scrubSecrets', () => {
	it('redacts credential shapes an agent might paste by accident', () => {
		for (const secret of [
			'sk-abcdefghijklmnopqrstuvwx',
			'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
			'AKIAIOSFODNN7EXAMPLE',
			'Bearer eyJhbGciOiJIUzI1NiJ9',
			'postgres://user:hunter2@db.example/neondb',
			'someone@example.com',
		]) {
			const scrubbed = scrubSecrets(`please index ${secret} for me`);
			expect(scrubbed, secret).toContain('[redacted]');
			expect(scrubbed, secret).not.toContain('hunter2');
		}
	});

	it('leaves ordinary prose alone', () => {
		const prose = 'how do I set up background jobs for image processing';
		expect(scrubSecrets(prose)).toBe(prose);
	});
});

describe('normalizeQueryText', () => {
	it('collapses whitespace, scrubs, then truncates to the column ceiling', () => {
		expect(normalizeQueryText('  multi   tenant\n billing ', 200)).toBe('multi tenant billing');
		// Long PROSE truncates. (A long unbroken alphanumeric run would instead be scrubbed, since
		// that is the shape of a raw key — see the next case.)
		expect(normalizeQueryText('background jobs '.repeat(40), 200)).toHaveLength(200);
		expect(normalizeQueryText('   ', 200)).toBeNull();
		expect(normalizeQueryText(42, 200)).toBeNull();
	});

	it('scrubs before truncating, so a long secret cannot survive by being cut short', () => {
		// Order matters: truncating first would leave the leading 200 characters of a key in the
		// column. Scrubbing first replaces the whole run.
		const out = normalizeQueryText(`lookup ${'A1b2C3d4'.repeat(30)}`, 200);
		expect(out).toBe('lookup [redacted]');
	});
});

describe('parseTraceparent', () => {
	const valid = '00-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-01';

	it('extracts only the 32-hex trace-id', () => {
		expect(parseTraceparent(valid)).toBe('0af7651916cd43dd8448eb211c80319c');
	});

	it('accepts a FUTURE version with extra fields appended', () => {
		// Start-anchored on purpose: a $-anchored pattern would silently drop every future-version
		// traceparent, which would read as "adoption fell off" rather than as a parser bug.
		expect(parseTraceparent(`${valid}-extrafield`)).toBe('0af7651916cd43dd8448eb211c80319c');
	});

	it('rejects malformed, all-zero, and oversized input', () => {
		expect(parseTraceparent('not-a-traceparent')).toBeNull();
		expect(parseTraceparent(`00-${'0'.repeat(32)}-00f067aa0ba902b7-01`)).toBeNull();
		expect(parseTraceparent(`${valid}${'x'.repeat(200)}`)).toBeNull();
		expect(parseTraceparent(null)).toBeNull();
		expect(parseTraceparent(12345)).toBeNull();
	});

	it('prefers the MCP-normative _meta location over the header', () => {
		const body = {
			params: { _meta: { traceparent: '00-11111111111111111111111111111111-00f067aa0ba902b7-01' } },
		};
		const headers = new Headers({ traceparent: valid });
		expect(resolveTraceId(body, headers)).toBe('11111111111111111111111111111111');
		// ...and falls back to the header, which is what clients actually send today.
		expect(resolveTraceId({}, headers)).toBe('0af7651916cd43dd8448eb211c80319c');
		expect(resolveTraceId({}, new Headers())).toBeNull();
	});

	it('does not throw on a hostile or unvalidated body', () => {
		// It is read BEFORE the transport validates the envelope, so it must tolerate anything.
		for (const body of [null, 42, [], { params: 'nope' }, { params: { _meta: 7 } }]) {
			expect(() => resolveTraceId(body, new Headers())).not.toThrow();
		}
	});
});

describe('classifyTraffic', () => {
	const secret = 'operator-secret';

	it('ranks a preview deployment above every other signal', () => {
		// Preview deploys share the PRODUCTION database, so they must never count as external even
		// when the operator drives them.
		expect(classifyTraffic({ headers: new Headers(), vercelEnv: 'preview', selfSecret: secret })).toBe('preview');
	});

	it('recognises the operator by a constant-time secret, not by a guessable header', () => {
		const withSecret = new Headers({ 'x-v10r-self': secret });
		expect(classifyTraffic({ headers: withSecret, vercelEnv: 'production', selfSecret: secret })).toBe('self');
		// Knowing the header's NAME is not enough.
		const wrong = new Headers({ 'x-v10r-self': 'guess' });
		expect(classifyTraffic({ headers: wrong, vercelEnv: 'production', selfSecret: secret })).toBe('external');
	});

	it('marks tooling as synthetic so it cannot inflate adoption', () => {
		for (const ua of ['curl/8.4.0', 'python-requests/2.31', 'vitest', 'Uptime-Monitor/1.0']) {
			expect(
				classifyTraffic({ headers: new Headers({ 'user-agent': ua }), vercelEnv: 'production', selfSecret: secret }),
				ua,
			).toBe('test');
		}
	});

	it('treats a real client as external', () => {
		expect(
			classifyTraffic({
				headers: new Headers({ 'user-agent': 'claude-code/2.1.89 (cli)' }),
				vercelEnv: 'production',
				selfSecret: secret,
			}),
		).toBe('external');
	});
});

describe('classifyClientFamily', () => {
	it('buckets to a bounded, most-specific-first domain', () => {
		expect(classifyClientFamily('claude-code/2.1.89 (cli)')).toBe('claude-code');
		expect(classifyClientFamily('Claude-User')).toBe('claude-web');
		expect(classifyClientFamily('Cursor/1.0')).toBe('cursor');
		expect(classifyClientFamily('curl/8.4.0')).toBe('curl');
		expect(classifyClientFamily('Mozilla/5.0 something')).toBe('other');
		expect(classifyClientFamily(null)).toBe('none');
	});

	it('never returns a value too wide for the column', () => {
		expect(classifyClientFamily('x'.repeat(10_000)).length).toBeLessThanOrEqual(32);
	});
});
