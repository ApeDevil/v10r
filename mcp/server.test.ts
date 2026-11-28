/**
 * Unit tests for the Pattern MCP (bun:test).
 * Vitest cannot collide: its include glob is src/** only.
 *
 * The protocol itself is the official SDK's and is not re-tested here; what is pinned is v10r's
 * wiring of it — the tools a connection sees, how a call reaches the registry, which answers the
 * registry (not the SDK) owns, and the era behaviour a real stdio connection gets from `serveStdio`.
 *
 * Run: bun test mcp/
 */
import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { InMemoryTransport, type JSONRPCMessage } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { loadRegistry } from '../pattern-library/load.ts';
import { buildById, topoSort } from '../pattern-library/schema.ts';
import { scorePatterns, tokenizePatternQuery } from '../pattern-library/search.ts';
import { readExcerpt, resolveSafe } from './security.ts';
import { STDIO_IDENTITY, stdioRegistry } from './stdio-server.ts';
import { createToolServer, type ToolRegistry } from './tool-server.ts';
import { handleToolCall, TOOLS } from './tools.ts';

const REPO_ROOT = resolve(import.meta.dir, '..');
const { registry } = loadRegistry();
if (!registry) {
	throw new Error('registry must load for tests');
}
const ctx = { registry, loadError: null, root: REPO_ROOT };

describe('registry', () => {
	test('loads the full two-tier registry with unique ids and honest tiers', () => {
		// Contract, not a count: the registry grows a record per pattern; pinning a
		// number here would make every legitimate addition a test edit.
		expect(registry.patterns.length).toBeGreaterThan(100);
		expect(new Set(registry.patterns.map((p) => p.id)).size).toBe(registry.patterns.length);
		for (const p of registry.patterns) {
			expect(['deep', 'light']).toContain(p.tier);
			if (p.tier === 'deep') {
				expect(p.invariants.length, p.id).toBeGreaterThan(0);
				expect(p.emulation_notes.length, p.id).toBeGreaterThan(0);
			} else {
				expect(p.invariants, p.id).toEqual([]);
				expect(p.emulation_notes, p.id).toEqual([]);
			}
		}
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
	test('tokenizePatternQuery drops stopwords and short tokens', () => {
		expect(tokenizePatternQuery('How is the RAG kernel wired?')).toEqual(['rag', 'kernel', 'wired']);
	});

	test('ranks the obvious pattern first', () => {
		expect(scorePatterns('background jobs cron', registry.patterns)[0]?.pattern.id).toBe('job-scheduling');
		expect(scorePatterns('design tokens component library', registry.patterns)[0]?.pattern.id).toBe('component-system');
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
		const excerpt = readExcerpt('package.json', { startLine: 1, lineCount: 5 }, REPO_ROOT);
		expect(excerpt.ok).toBe(true);
		expect(excerpt.shownTo).toBe(5);
		const capped = readExcerpt('README.md', { startLine: 1, lineCount: 9999 }, REPO_ROOT);
		expect(capped.ok).toBe(true);
		expect((capped.shownTo ?? 0) - (capped.shownFrom ?? 0)).toBeLessThan(250);
	});

	test('start beyond EOF is an actionable error', () => {
		const excerpt = readExcerpt('package.json', { startLine: 100000, lineCount: 5 }, REPO_ROOT);
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

	// The fitness block is how an agent rules a pattern OUT. A plan that lists steps without
	// their contraindications, or without the infrastructure the whole plan needs, reads as
	// an unconditional recommendation.
	test("recommend_emulation_plan carries each step's contraindications and the needs by level", () => {
		const result = handleToolCall('recommend_emulation_plan', { capabilities: ['grounded answers', 'caching'] }, ctx);
		const body = result.content[0]?.text ?? '';
		expect(body).toContain('**Avoid when:**');
		expect(body).toMatch(/- Required infrastructure: [a-z-]+(, [a-z-]+)*\./);
		const needs = /- Required infrastructure: ([a-z, -]+)\./.exec(body)?.[1].split(', ') ?? [];
		expect(needs.length).toBe(new Set(needs).size);
		expect(needs).toContain('vector-search');
		// The shared cache tier is conditional, never stated as required.
		expect(needs).not.toContain('key-value-store');
		expect(body).toMatch(/- Conditional infrastructure: .*key-value-store/);
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

// biome-ignore lint/suspicious/noExplicitAny: tests read arbitrary JSON-RPC shapes
type Reply = Record<string, any>;

/**
 * One stdio connection, exactly as `mcp/stdio-server.ts` serves it (`serveStdio` + the shared tool
 * server), over an in-memory pipe instead of process stdio. `send` resolves with the reply to
 * that id.
 */
async function connection(served: ToolRegistry = stdioRegistry(ctx)) {
	const [client, server] = InMemoryTransport.createLinkedPair();
	const handle = serveStdio(() => createToolServer(served, STDIO_IDENTITY), { transport: server });
	const pending = new Map<string | number, (reply: Reply) => void>();
	client.onmessage = (message: JSONRPCMessage) => {
		const reply = message as Reply;
		pending.get(reply.id)?.(reply);
	};
	await client.start();
	let next = 1;
	return {
		send(method: string, params?: Record<string, unknown>): Promise<Reply> {
			const id = next++;
			const answered = new Promise<Reply>((resolveReply) => pending.set(id, resolveReply));
			void client.send({ jsonrpc: '2.0', id, method, ...(params && { params }) } as JSONRPCMessage);
			return answered;
		},
		notify(method: string) {
			return client.send({ jsonrpc: '2.0', method } as JSONRPCMessage);
		},
		close: () => handle.close(),
	};
}

const INITIALIZE = { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } };

/** The 2026-07-28 per-request envelope, no handshake. */
function modern(params: Record<string, unknown> = {}, version = '2026-07-28') {
	return {
		...params,
		_meta: { 'io.modelcontextprotocol/protocolVersion': version, 'io.modelcontextprotocol/clientCapabilities': {} },
	};
}

async function legacyConnection(served?: ToolRegistry) {
	const conn = await connection(served);
	const init = await conn.send('initialize', INITIALIZE);
	await conn.notify('notifications/initialized');
	return { conn, init };
}

describe('stdio — legacy era (initialize handshake)', () => {
	test('initialize negotiates the requested version and ships the instructions', async () => {
		const { conn, init } = await legacyConnection();
		expect(init.result.protocolVersion).toBe('2025-11-25');
		expect(init.result.serverInfo).toEqual({ name: 'v10r-patterns', version: '1.0.0' });
		expect(init.result.capabilities).toEqual({ tools: { listChanged: false } });
		expect(init.result.instructions.length).toBeGreaterThan(100);
		await conn.close();
	});

	test('tools/list is the eight tool definitions, byte for byte — no title, annotations or outputSchema', async () => {
		const { conn } = await legacyConnection();
		const list = await conn.send('tools/list');
		expect(list.result.tools).toEqual(TOOLS);
		expect(JSON.stringify(list.result.tools)).toBe(JSON.stringify(TOOLS));
		await conn.close();
	});

	test('a call reaches the registry, and the registry — not the SDK — answers malformed arguments', async () => {
		const { conn } = await legacyConnection();
		const good = await conn.send('tools/call', { name: 'get_pattern', arguments: { id: 'singleflight' } });
		expect(good.result.isError).toBeUndefined();
		expect(good.result.content[0].text).toContain('singleflight');
		// A missing required argument is the registry's recoverable error with a next call, not an
		// SDK "Input validation error": the advertised schema is not enforced in front of the registry.
		const bad = await conn.send('tools/call', { name: 'search_patterns', arguments: {} });
		expect(bad.result.isError).toBe(true);
		expect(bad.result.content[0].text).toContain('## Next actions');
		expect(bad.result.content[0].text).not.toContain('Input validation error');
		await conn.close();
	});

	test('an unknown tool is the protocol error -32602 and is never dispatched', async () => {
		let dispatched = 0;
		const counting: ToolRegistry = {
			tools: TOOLS,
			dispatch: (name, args) => {
				dispatched++;
				return handleToolCall(name, args, ctx);
			},
		};
		const { conn } = await legacyConnection(counting);
		const reply = await conn.send('tools/call', { name: 'set_mcp_page_message', arguments: {} });
		expect(reply.error.code).toBe(-32602);
		expect(dispatched).toBe(0);
		await conn.close();
	});

	test('a throwing tool answers a generic isError — the exception text never reaches the wire', async () => {
		const throwing: ToolRegistry = {
			tools: TOOLS,
			dispatch: () => {
				throw new Error('SELECT secret FROM internal_table');
			},
		};
		const { conn } = await legacyConnection(throwing);
		const reply = await conn.send('tools/call', { name: 'get_pattern', arguments: { id: 'x' } });
		expect(reply.result.isError).toBe(true);
		expect(JSON.stringify(reply)).not.toContain('secret');
		await conn.close();
	});

	test('ping answers and unknown methods are -32601', async () => {
		const { conn } = await legacyConnection();
		expect((await conn.send('ping')).result).toEqual({});
		expect((await conn.send('no/such')).error.code).toBe(-32601);
		expect((await conn.send('constructor')).error.code).toBe(-32601);
		await conn.close();
	});
});

describe('stdio — modern era (2026-07-28)', () => {
	test('server/discover advertises the modern revision, tools only, with caching hints', async () => {
		const conn = await connection();
		const { result } = await conn.send('server/discover', modern());
		expect(result.resultType).toBe('complete');
		expect(result.supportedVersions).toEqual(['2026-07-28']);
		expect(result.capabilities).toEqual({ tools: { listChanged: false } });
		expect(result.instructions.length).toBeGreaterThan(100);
		expect(result.cacheScope).toBe('public');
		expect(result.ttlMs).toBe(3_600_000);
		expect(result._meta['io.modelcontextprotocol/serverInfo'].name).toBe('v10r-patterns');
		await conn.close();
	});

	test('tools/list and tools/call serve the same tools, marked complete', async () => {
		const conn = await connection();
		const list = (await conn.send('tools/list', modern())).result;
		expect(list.tools).toEqual(TOOLS);
		expect(list).toMatchObject({ resultType: 'complete', cacheScope: 'public' });
		const call = (await conn.send('tools/call', modern({ name: 'get_pattern', arguments: { id: 'singleflight' } })))
			.result;
		expect(call.resultType).toBe('complete');
		expect(call.isError).toBeUndefined();
		expect(call.content[0].text).toContain('singleflight');
		await conn.close();
	});

	test('an unknown tool is -32602; removed methods are -32601', async () => {
		const conn = await connection();
		expect((await conn.send('tools/call', modern({ name: 'set_mcp_page_message' }))).error.code).toBe(-32602);
		expect((await conn.send('ping', modern())).error.code).toBe(-32601);
		await conn.close();
	});

	test('an unsupported modern revision answers -32022 listing the modern revisions only', async () => {
		const conn = await connection();
		const reply = await conn.send('server/discover', modern({}, '2099-01-01'));
		expect(reply.error).toMatchObject({ code: -32022, data: { supported: ['2026-07-28'], requested: '2099-01-01' } });
		await conn.close();
	});

	test('an invalid envelope answers -32602', async () => {
		const conn = await connection();
		const reply = await conn.send('tools/list', { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } });
		expect(reply.error.code).toBe(-32602);
		await conn.close();
	});
});
