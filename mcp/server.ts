/**
 * v10r Pattern MCP — read-only stdio MCP server exposing the curated pattern registry.
 *
 * Zero dependencies: hand-rolled JSON-RPC 2.0 over newline-delimited stdio (MCP spec
 * 2025-11-25). Spawned by an MCP client as an ephemeral container:
 *
 *   podman run -i --rm --network=none -v <repo>:/v10r:ro docker.io/oven/bun:1.3.12 bun /v10r/mcp/server.ts
 *
 * Rules this file enforces: stdout carries protocol frames only (logs go to stderr),
 * notifications never get replies, tool failures are isError results (never crashes),
 * and the process self-terminates on stdin EOF / SIGTERM / SIGINT / EPIPE so no
 * orphan containers accumulate when the client exits uncleanly.
 */

import { loadRegistry } from '../pattern-library/load.ts';
import { createLineBuffer, ERR, err, type Id, isNotification, ok, parseLine, type RpcMessage } from './protocol.ts';

import { handleToolCall, TOOLS, type ToolContext } from './tools.ts';

const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];
const SERVER_INFO = { name: 'v10r-patterns', version: '1.0.0' };
const INSTRUCTIONS =
	'The v10r-patterns server exposes this repository as a curated pattern library: proven full-stack patterns, ' +
	'each paired with the docs that explain it, the code that implements it, the tests that pin it, and the showcase ' +
	'route that proves it. Reach for it before building any feature that resembles something v10r already does — ' +
	'auth-adjacent backends, AI tools and surfaces, RAG, design systems, background jobs. Call search_patterns or ' +
	'trace_capability to find the canonical pattern, get_pattern for its full card with invariants, get_file_excerpt ' +
	'to read the exact reference code, recommend_emulation_plan for a dependency-ordered build plan, and validate_snippet ' +
	'to check code you wrote against v10r conventions (loop on it until clean). It complements ' +
	'Read and Grep rather than replacing them: use it to discover the blessed pattern and its invariants, then explore freely.';

const loaded = loadRegistry();
if (loaded.error) {
	console.error(`[v10r-patterns] registry load failed: ${loaded.error}`);
}
const ctx: ToolContext = { registry: loaded.registry, loadError: loaded.error };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function handleInitialize(params: unknown, id: Id): string {
	const requested = isRecord(params) && typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
	const protocolVersion = SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0];
	return ok(id, {
		protocolVersion,
		capabilities: { tools: {} },
		serverInfo: SERVER_INFO,
		instructions: INSTRUCTIONS,
	});
}

function handleToolsCall(params: unknown, id: Id): string {
	if (!isRecord(params) || typeof params.name !== 'string') {
		return err(id, ERR.BAD_PARAMS, 'Invalid params: tools/call requires { name: string, arguments?: object }');
	}
	try {
		const result = handleToolCall(params.name, params.arguments, ctx);
		return ok(id, result);
	} catch (cause) {
		console.error(`[v10r-patterns] tool '${params.name}' threw: ${String(cause)}`);
		return ok(id, {
			content: [{ type: 'text', text: `Tool '${params.name}' failed unexpectedly: ${String(cause)}` }],
			isError: true,
		});
	}
}

const requestHandlers: Record<string, (params: unknown, id: Id) => string> = {
	initialize: handleInitialize,
	ping: (_params, id) => ok(id, {}),
	'tools/list': (_params, id) => ok(id, { tools: TOOLS }),
	'tools/call': handleToolsCall,
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
	const handler = requestHandlers[msg.method];
	if (!handler) {
		return err(msg.id ?? null, ERR.NO_METHOD, `Method not found: ${msg.method}`);
	}
	return handler(msg.params, msg.id ?? null);
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
