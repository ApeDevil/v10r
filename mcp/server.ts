/**
 * v10r Pattern MCP — read-only stdio MCP server exposing the curated pattern registry.
 *
 * Zero dependencies: hand-rolled JSON-RPC 2.0 over newline-delimited stdio, dual-era — the
 * 2025-11-25 `initialize` handshake and the 2026-07-28 per-request `_meta` protocol, routed per
 * message by `protocol-era.ts` (shared with the hosted transport). Spawned by an MCP client as an
 * ephemeral container:
 *
 *   podman run -i --rm --network=none -v <repo>:/v10r:ro docker.io/oven/bun:1.3.12 bun /v10r/mcp/server.ts
 *
 * Rules this file enforces: stdout carries protocol frames only (logs go to stderr),
 * notifications never get replies, tool failures are isError results (never crashes),
 * and the process self-terminates on stdin EOF / SIGTERM / SIGINT / EPIPE so no
 * orphan containers accumulate when the client exits uncleanly.
 */

import { loadRegistry } from '../pattern-library/load.ts';
import { QUERY_WORKFLOW } from '../pattern-library/query.ts';
import { createLineBuffer, ERR, err, type Id, isNotification, ok, parseLine, type RpcMessage } from './protocol.ts';
import {
	cacheableResult,
	completeResult,
	discoverResult,
	type ModernServerDescription,
	modernMethodNotFound,
	modernUnknownTool,
	routeMcpRequest,
} from './protocol-era.ts';
import { negotiateLegacyProtocolVersion } from './protocol-version.ts';
import { handleToolCall, TOOLS, type ToolContext } from './tools.ts';

const SERVER_INFO = { name: 'v10r-patterns', version: '1.0.0' };
const INSTRUCTIONS =
	'The v10r-patterns server exposes this repository as a curated pattern library: proven full-stack patterns, ' +
	'each paired with the docs that explain it, the code that implements it, the tests that pin it, and the showcase ' +
	'route that proves it. Reach for it before building any feature that resembles something v10r already does — ' +
	`auth-adjacent backends, AI tools and surfaces, RAG, design systems, background jobs. ${QUERY_WORKFLOW} It complements ` +
	'Read and Grep rather than replacing them: use it to discover the blessed pattern and its invariants, then explore freely.';

/** The pattern registry is public data and this process has one client: nothing user-specific to scope. */
const MODERN_SERVER: ModernServerDescription = {
	serverInfo: SERVER_INFO,
	instructions: INSTRUCTIONS,
	cacheScope: 'public',
};

const loaded = loadRegistry();
if (loaded.error) {
	console.error(`[v10r-patterns] registry load failed: ${loaded.error}`);
}
const ctx: ToolContext = { registry: loaded.registry, loadError: loaded.error };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function handleInitialize(params: unknown, id: Id): string {
	return ok(id, {
		protocolVersion: negotiateLegacyProtocolVersion(isRecord(params) ? params.protocolVersion : undefined),
		capabilities: { tools: {} },
		serverInfo: SERVER_INFO,
		instructions: INSTRUCTIONS,
	});
}

type CallOutcome = { result: Record<string, unknown> } | { badParams: string };

function callTool(params: unknown): CallOutcome {
	if (!isRecord(params) || typeof params.name !== 'string') {
		return { badParams: 'Invalid params: tools/call requires { name: string, arguments?: object }' };
	}
	try {
		return { result: { ...handleToolCall(params.name, params.arguments, ctx) } };
	} catch (cause) {
		console.error(`[v10r-patterns] tool '${params.name}' threw: ${String(cause)}`);
		return {
			result: {
				content: [{ type: 'text', text: `Tool '${params.name}' failed unexpectedly: ${String(cause)}` }],
				isError: true,
			},
		};
	}
}

function handleToolsCall(params: unknown, id: Id): string {
	const outcome = callTool(params);
	return 'badParams' in outcome ? err(id, ERR.BAD_PARAMS, outcome.badParams) : ok(id, outcome.result);
}

/** The 2025-era methods, unchanged. */
const requestHandlers: Record<string, (params: unknown, id: Id) => string> = {
	initialize: handleInitialize,
	ping: (_params, id) => ok(id, {}),
	'tools/list': (_params, id) => ok(id, { tools: TOOLS }),
	'tools/call': handleToolsCall,
};

/**
 * The 2026-07-28 methods — the same tools, dressed for the modern era. `initialize`, `ping` and the
 * other removed methods are absent, so they answer -32601 like any method this server lacks.
 */
const modernHandlers: Record<string, (params: unknown, id: Id) => string> = {
	'server/discover': (_params, id) => ok(id, discoverResult(MODERN_SERVER)),
	'tools/list': (_params, id) => ok(id, cacheableResult({ tools: TOOLS }, MODERN_SERVER)),
	'tools/call': (params, id) => {
		if (isRecord(params) && typeof params.name === 'string' && !TOOLS.some((tool) => tool.name === params.name)) {
			const unknown = modernUnknownTool(params.name);
			return err(id, unknown.code, unknown.message, unknown.data);
		}
		const outcome = callTool(params);
		return 'badParams' in outcome
			? err(id, ERR.BAD_PARAMS, outcome.badParams)
			: ok(id, completeResult(outcome.result, MODERN_SERVER));
	},
};

export function dispatchLine(line: string): string | null {
	const outcome = parseLine(line);
	if (outcome.kind === 'parse-error') {
		return err(null, ERR.PARSE, 'Parse error');
	}
	if (outcome.kind === 'batch') {
		return err(null, ERR.INVALID_REQ, 'Batch requests are not supported');
	}
	if (outcome.kind === 'invalid') {
		return err(null, ERR.INVALID_REQ, 'Invalid Request');
	}
	const msg: RpcMessage = outcome.msg;
	if (typeof msg.method !== 'string' || msg.method.length === 0) {
		return err(msg.id ?? null, ERR.INVALID_REQ, 'Invalid Request: missing method');
	}
	if (isNotification(msg)) {
		if (!msg.method.startsWith('notifications/')) {
			console.error(`[v10r-patterns] ignoring unknown notification-style message: ${msg.method}`);
		}
		return null;
	}
	const id = msg.id ?? null;
	// No headers on stdio: the era is the body's envelope claim alone.
	const route = routeMcpRequest(msg.method, msg.params, null);
	if (route.era === 'rejected') {
		return err(id, route.error.code, route.error.message, route.error.data);
	}
	if (route.era === 'modern') {
		const modern = Object.hasOwn(modernHandlers, msg.method) ? modernHandlers[msg.method] : undefined;
		if (!modern) {
			const notFound = modernMethodNotFound(msg.method).error;
			return err(id, notFound.code, notFound.message);
		}
		return modern(msg.params, id);
	}
	const handler = Object.hasOwn(requestHandlers, msg.method) ? requestHandlers[msg.method] : undefined;
	if (!handler) {
		return err(id, ERR.NO_METHOD, `Method not found: ${msg.method}`);
	}
	return handler(msg.params, id);
}

function write(frame: string | null): void {
	if (frame !== null) {
		process.stdout.write(frame);
	}
}

async function runLoop(): Promise<void> {
	const decoder = new TextDecoder('utf-8');
	const lines = createLineBuffer();
	for await (const chunk of Bun.stdin.stream()) {
		for (const line of lines.push(decoder.decode(chunk, { stream: true }))) {
			write(dispatchLine(line));
		}
	}
	for (const line of lines.push(decoder.decode())) {
		write(dispatchLine(line));
	}
	for (const line of lines.flush()) {
		write(dispatchLine(line));
	}
}

if (import.meta.main) {
	process.on('SIGTERM', () => process.exit(0));
	process.on('SIGINT', () => process.exit(0));
	process.stdout.on('error', () => process.exit(0));
	console.error(
		`[v10r-patterns] ready (registry: ${ctx.registry ? `${ctx.registry.patterns.length} patterns` : 'FAILED'})`,
	);
	await runLoop();
	process.exit(0);
}
