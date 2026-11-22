/**
 * v10r Pattern MCP — the read-only stdio MCP server over the curated pattern registry (source).
 *
 * The protocol is the official SDK's (`@modelcontextprotocol/server/stdio`): newline-delimited
 * JSON-RPC, the 2025-era `initialize` handshake and the stateless 2026-07-28 era, chosen per
 * connection by `serveStdio`. This file only wires the eight tools (`tools.ts`) into the shared
 * SDK bridge (`tool-server.ts`, which the hosted transport uses too).
 *
 * Clients never run this file: they run `mcp/server.ts`, which starts the self-contained bundle
 * built from it (`bun run mcp:bundle:build` → `server.bundle.js`), because the container mounts
 * the repo read-only with no node_modules. `bun mcp/stdio-server.ts` serves straight from source
 * wherever node_modules is installed.
 *
 * Rules this file enforces: stdout carries protocol frames only (logs go to stderr), and the
 * process exits on stdin EOF / SIGTERM / SIGINT / EPIPE so no orphan containers accumulate when
 * the client exits uncleanly.
 */

import { join } from 'node:path';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { loadRegistry } from '../pattern-library/load.ts';
import { QUERY_WORKFLOW } from '../pattern-library/query.ts';
import { createToolServer, type McpServerIdentity, type ToolRegistry } from './tool-server.ts';
import { handleToolCall, TOOLS, type ToolContext } from './tools.ts';

const INSTRUCTIONS =
	'The v10r-patterns server exposes this repository as a curated pattern library: proven full-stack patterns, ' +
	'each paired with the docs that explain it, the code that implements it, the tests that pin it, and the showcase ' +
	'route that proves it. Reach for it before building any feature that resembles something v10r already does — ' +
	`auth-adjacent backends, AI tools and surfaces, RAG, design systems, background jobs. ${QUERY_WORKFLOW} It complements ` +
	'Read and Grep rather than replacing them: use it to discover the blessed pattern and its invariants, then explore freely.';

/** The pattern registry is public data and this process has one client: nothing user-specific to scope. */
export const STDIO_IDENTITY: McpServerIdentity = {
	name: 'v10r-patterns',
	version: '1.0.0',
	instructions: INSTRUCTIONS,
	cacheScope: 'public',
};

/** The eight tools over the read-only mount, as a registry the SDK bridge serves. */
export function stdioRegistry(ctx: ToolContext): ToolRegistry {
	return { tools: TOOLS, dispatch: (name, args) => handleToolCall(name, args, ctx) };
}

/**
 * Serve the pattern registry on this process's stdio until stdin closes. Exported so the stable
 * entry (`server.ts`) can start the bundle it imports; `import.meta.main` starts it when this file
 * — or the bundle — is the process entry.
 */
export function startStdioServer(): void {
	// Resolved from THIS file, not from load.ts: in the bundle every module shares one directory.
	const loaded = loadRegistry(join(import.meta.dir, '..', 'pattern-library'));
	if (loaded.error) {
		console.error(`[v10r-patterns] registry load failed: ${loaded.error}`);
	}
	const registry = stdioRegistry({ registry: loaded.registry, loadError: loaded.error });
	const exit = () => process.exit(0);
	process.on('SIGTERM', exit);
	process.on('SIGINT', exit);
	process.stdout.on('error', exit);
	serveStdio(
		() =>
			createToolServer(registry, STDIO_IDENTITY, {
				onToolError: (name, cause) => console.error(`[v10r-patterns] tool '${name}' threw: ${String(cause)}`),
			}),
		{ onerror: (error) => console.error(`[v10r-patterns] ${error.message}`) },
	);
	console.error(
		`[v10r-patterns] ready (registry: ${loaded.registry ? `${loaded.registry.patterns.length} patterns` : 'FAILED'})`,
	);
}

if (import.meta.main) startStdioServer();
