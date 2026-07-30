/**
 * Unit tests for the Pattern MCP (bun:test — runs with zero node_modules).
 * Vitest cannot collide: its include glob is src/** only.
 *
 * Run: podman run --rm -v <repo>:/v10r:ro docker.io/oven/bun:1.3.12 bun test /v10r/mcp/
 */
import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { createLineBuffer, err, isNotification, ok, parseLine } from './protocol.ts';
import { buildById, loadRegistry, topoSort } from './registry.ts';
import { readExcerpt, resolveSafe } from './security.ts';
import { dispatchLine } from './server.ts';
import { handleToolCall, scorePatterns, TOOLS, tokenize } from './tools.ts';

const REPO_ROOT = resolve(import.meta.dir, '..');
const { registry } = loadRegistry();
if (!registry) {
	throw new Error('registry must load for tests');
}
const ctx = { registry, loadError: null, root: REPO_ROOT };

describe('protocol', () => {
	test('parseLine classifies messages, batches, garbage', () => {
		expect(parseLine('{"jsonrpc":"2.0","id":1,"method":"ping"}').kind).toBe('message');
		expect(parseLine('[1,2]').kind).toBe('batch');
		expect(parseLine('42').kind).toBe('invalid');
		expect(parseLine('not json').kind).toBe('parse-error');
	});

	test('notification = message without id key', () => {
		expect(isNotification({ method: 'notifications/initialized' })).toBe(true);
		expect(isNotification({ id: 0, method: 'ping' })).toBe(false);
		expect(isNotification({ id: null, method: 'ping' })).toBe(false);
	});

	test('frames are single-line NDJSON', () => {
		expect(ok(1, { a: 1 })).toBe('{"jsonrpc":"2.0","id":1,"result":{"a":1}}\n');
		expect(err(null, -32700, 'Parse error')).toContain('"code":-32700');
		expect(ok(1, { s: 'x' }).slice(0, -1)).not.toContain('\n');
	});

	test('line buffer survives chunk splits and CRLF', () => {
		const buffer = createLineBuffer();
		expect(buffer.push('{"a"')).toEqual([]);
		expect(buffer.push(':1}\r\n{"b":2}\n{"c"')).toEqual(['{"a":1}', '{"b":2}']);
		expect(buffer.push(':3}')).toEqual([]);
		expect(buffer.flush()).toEqual(['{"c":3}']);
	});
});

describe('registry', () => {
	test('loads 11 valid patterns with unique ids', () => {
		expect(registry.patterns.length).toBe(11);
		expect(new Set(registry.patterns.map((p) => p.id)).size).toBe(11);
	});

	test('topoSort puts dependencies first, deterministically', () => {
		const byId = buildById(registry);
		const order = registry.patterns.map((p) => p.id);
		const { order: sorted, cyclic } = topoSort(
			['deskbot-approval-gate', 'ai-surfaces', 'ai-tool-harness'],
			byId,
			order,
		);
		expect(cyclic).toBe(false);
		expect(sorted).toEqual(['ai-tool-harness', 'ai-surfaces', 'deskbot-approval-gate']);
	});
});

describe('search', () => {
	test('tokenize drops stopwords and short tokens', () => {
		expect(tokenize('How is the RAG kernel wired?')).toEqual(['rag', 'kernel', 'wired']);
	});

	test('ranks the obvious pattern first', () => {
		expect(scorePatterns('background jobs cron', registry.patterns)[0]?.pattern.id).toBe('jobs-scheduler');
		expect(scorePatterns('design tokens component library', registry.patterns)[0]?.pattern.id).toBe(
			'ui-component-system',
		);
		expect(scorePatterns('grounded answers citations', registry.patterns)[0]?.pattern.id).toBe('layered-rag');
	});

	test('no match yields empty list', () => {
		expect(scorePatterns('quantum teleportation blockchain', registry.patterns)).toEqual([]);
	});
});

describe('security', () => {
	test('rejects absolute, traversal, and denylisted paths', () => {
		expect(resolveSafe('/etc/passwd', REPO_ROOT).ok).toBe(false);
		expect(resolveSafe('../../etc/passwd', REPO_ROOT).ok).toBe(false);
		expect(resolveSafe('.env', REPO_ROOT).ok).toBe(false);
		expect(resolveSafe('src/../.env', REPO_ROOT).ok).toBe(false);
		expect(resolveSafe('node_modules/bun-types/package.json', REPO_ROOT).ok).toBe(false);
		expect(resolveSafe('.git/config', REPO_ROOT).ok).toBe(false);
	});

	test('accepts real repo files and bounds excerpts', () => {
		const excerpt = readExcerpt('package.json', 1, 5, REPO_ROOT);
		expect(excerpt.ok).toBe(true);
		expect(excerpt.shownTo).toBe(5);
		const capped = readExcerpt('README.md', 1, 9999, REPO_ROOT);
		expect(capped.ok).toBe(true);
		expect((capped.shownTo ?? 0) - (capped.shownFrom ?? 0)).toBeLessThan(250);
	});

	test('start beyond EOF is an actionable error', () => {
		const excerpt = readExcerpt('package.json', 100000, 5, REPO_ROOT);
		expect(excerpt.ok).toBe(false);
		expect(excerpt.text).toContain('beyond EOF');
	});
});

describe('tools', () => {
	test('tool defs never carry the Claude Code killer fields', () => {
		for (const tool of TOOLS) {
			expect(Object.keys(tool).sort()).toEqual(['description', 'inputSchema', 'name']);
		}
	});

	test('get_pattern returns full card; bad id lists valid ids', () => {
		const good = handleToolCall('get_pattern', { id: 'layered-rag' }, ctx);
		expect(good.isError).toBeUndefined();
		expect(good.content[0]?.text).toContain('Invariants');
		const bad = handleToolCall('get_pattern', { id: 'nope' }, ctx);
		expect(bad.isError).toBe(true);
		expect(bad.content[0]?.text).toContain('multi-client-core');
	});

	test('recommend_emulation_plan orders dependencies and reports unmatched', () => {
		const result = handleToolCall(
			'recommend_emulation_plan',
			{ capabilities: ['grounded answers', 'quantum teleport'] },
			ctx,
		);
		expect(result.isError).toBeUndefined();
		const body = result.content[0]?.text ?? '';
		expect(body.indexOf('multi-client-core')).toBeLessThan(body.indexOf('layered-rag'));
		expect(body).toContain('Unmatched capabilities');
		expect(body).toContain('quantum teleport');
	});

	test('tool results are text-only — structuredContent hides text from Claude Code', () => {
		for (const [name, args] of [
			['search_patterns', { query: 'jobs' }],
			['get_pattern', { id: 'layered-rag' }],
			['trace_capability', { capability: 'rag ingest' }],
			['recommend_emulation_plan', { capabilities: ['ai chat'] }],
			['get_file_excerpt', { path: 'package.json', line_count: 3 }],
		] as const) {
			const result = handleToolCall(name, args, ctx);
			expect('structuredContent' in result).toBe(false);
		}
	});

	test('registry load failure degrades to isError, not crash', () => {
		const broken = handleToolCall('search_patterns', { query: 'jobs' }, { registry: null, loadError: 'boom' });
		expect(broken.isError).toBe(true);
		expect(broken.content[0]?.text).toContain('boom');
	});
});

describe('dispatch', () => {
	test('initialize negotiates version and ships instructions', () => {
		const reply = dispatchLine(
			'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}',
		);
		const parsed = JSON.parse(reply ?? '{}');
		expect(parsed.result.protocolVersion).toBe('2025-06-18');
		expect(parsed.result.serverInfo.name).toBe('v10r-patterns');
		expect(parsed.result.instructions.length).toBeGreaterThan(100);
	});

	test('unsupported version falls back to newest supported', () => {
		const reply = dispatchLine(
			'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"1999-01-01"}}',
		);
		expect(JSON.parse(reply ?? '{}').result.protocolVersion).toBe('2025-11-25');
	});

	test('notifications produce no reply; batch and garbage produce errors', () => {
		expect(dispatchLine('{"jsonrpc":"2.0","method":"notifications/initialized"}')).toBeNull();
		expect(JSON.parse(dispatchLine('[{"jsonrpc":"2.0","id":1,"method":"ping"}]') ?? '{}').error.code).toBe(-32600);
		expect(JSON.parse(dispatchLine('garbage') ?? '{}').error.code).toBe(-32700);
		expect(JSON.parse(dispatchLine('{"jsonrpc":"2.0","id":9,"method":"nope"}') ?? '{}').error.code).toBe(-32601);
	});

	test('ping and tools/list respond', () => {
		expect(JSON.parse(dispatchLine('{"jsonrpc":"2.0","id":1,"method":"ping"}') ?? '{}').result).toEqual({});
		const list = JSON.parse(dispatchLine('{"jsonrpc":"2.0","id":2,"method":"tools/list"}') ?? '{}');
		expect(list.result.tools.length).toBe(6);
	});
});
