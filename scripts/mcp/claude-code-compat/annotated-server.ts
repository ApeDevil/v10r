/**
 * The v10r stdio pattern server with tool metadata added on the way out — a TEST FIXTURE for the
 * Claude Code compatibility check (roadmap B1), never a registration anyone keeps.
 *
 * It runs the REAL stdio server — the committed bundle `mcp/server.bundle.js`, exactly what
 * `mcp/server.ts` starts for every client — as a child process, and only rewrites `tools/list`
 * results on their way back (both eras), adding the fields the check is about:
 *   V10R_COMPAT_FIELDS=none          control — byte-identical to the real server
 *   V10R_COMPAT_FIELDS=title         `title` on every tool
 *   V10R_COMPAT_FIELDS=readOnlyHint  `annotations: { readOnlyHint: true }` on every tool (true: all eight are read-only)
 *   V10R_COMPAT_FIELDS=both          both
 *
 *   bun scripts/mcp/claude-code-compat/annotated-server.ts               # stdio
 *   bun scripts/mcp/claude-code-compat/annotated-server.ts --http 8790   # POST http://127.0.0.1:8790/mcp
 *
 * Dependency-free on purpose: it imports nothing but Node/Bun built-ins, so it runs in the same
 * bare `oven/bun` container as the real server — read-only mount, no network, no node_modules.
 * The `--http` mode is a thin line bridge (one POST → one stdio line → the matching answer) over
 * that same child: the check is about how Claude Code treats the tool list, not about HTTP header
 * rules, which the hosted endpoints and their conformance lane cover.
 *
 * The real server's tool definitions stay free of these fields until the check passes on a
 * current Claude Code (pattern-mcp.md §Client design constraints). Runbook:
 * docs/blueprint/architecture/mcp-evolution/claude-code-compat.md.
 */
import { join } from 'node:path';

type Fields = 'none' | 'title' | 'readOnlyHint' | 'both';

const FIELDS = (process.env.V10R_COMPAT_FIELDS ?? 'none') as Fields;
if (!['none', 'title', 'readOnlyHint', 'both'].includes(FIELDS)) {
	console.error(`[compat] unknown V10R_COMPAT_FIELDS=${FIELDS}`);
	process.exit(2);
}

const BUNDLE = join(import.meta.dir, '../../../mcp/server.bundle.js');

/** `search_patterns` → `Search patterns`. */
function titleOf(name: string): string {
	const words = name.replaceAll('_', ' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
}

function annotate(tool: Record<string, unknown>): Record<string, unknown> {
	const name = String(tool.name);
	return {
		...tool,
		...((FIELDS === 'title' || FIELDS === 'both') && { title: titleOf(name) }),
		...((FIELDS === 'readOnlyHint' || FIELDS === 'both') && { annotations: { readOnlyHint: true } }),
	};
}

/** Pass every frame through; add the fields to a tools/list result. */
export function rewriteFrame(line: string): string {
	if (FIELDS === 'none') return line;
	let reply: { result?: { tools?: Array<Record<string, unknown>> } };
	try {
		reply = JSON.parse(line);
	} catch {
		return line;
	}
	if (!Array.isArray(reply.result?.tools)) return line;
	reply.result.tools = reply.result.tools.map(annotate);
	return JSON.stringify(reply);
}

/** The real server as a child: stdin is fed by the caller, each stdout line goes to `onLine`. */
function spawnServer(onLine: (line: string) => void) {
	const child = Bun.spawn([process.execPath, BUNDLE], { stdin: 'pipe', stdout: 'pipe', stderr: 'inherit' });
	const drained = (async () => {
		const decoder = new TextDecoder();
		let buffered = '';
		for await (const chunk of child.stdout) {
			buffered += decoder.decode(chunk, { stream: true });
			const lines = buffered.split('\n');
			buffered = lines.pop() ?? '';
			for (const line of lines) if (line.trim().length > 0) onLine(line);
		}
	})();
	return { child, drained };
}

async function serveStdio(): Promise<void> {
	const { child, drained } = spawnServer((line) => process.stdout.write(`${rewriteFrame(line)}\n`));
	for await (const chunk of Bun.stdin.stream()) {
		child.stdin.write(chunk);
		await child.stdin.flush();
	}
	await child.stdin.end();
	const code = await child.exited;
	await drained; // every answer the server wrote is forwarded before this process ends
	process.exit(code);
}

function serveHttp(port: number): void {
	const pending = new Map<string, (line: string) => void>();
	const { child } = spawnServer((line) => {
		let id: unknown;
		try {
			id = (JSON.parse(line) as { id?: unknown }).id;
		} catch {
			return;
		}
		const resolve = pending.get(JSON.stringify(id));
		if (resolve) {
			pending.delete(JSON.stringify(id));
			resolve(line);
		}
	});
	// 0.0.0.0 only inside a container, where the port is published to the host's loopback.
	const hostname = process.env.V10R_COMPAT_HOST ?? '127.0.0.1';
	Bun.serve({
		hostname,
		port,
		async fetch(request) {
			if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
			const body = (await request.text()).trim();
			let message: { id?: unknown };
			try {
				message = JSON.parse(body);
			} catch {
				return Response.json(
					{ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
					{ status: 400 },
				);
			}
			const answered =
				'id' in message ? new Promise<string>((resolve) => pending.set(JSON.stringify(message.id), resolve)) : null;
			child.stdin.write(`${JSON.stringify(message)}\n`);
			await child.stdin.flush();
			if (answered === null) return new Response(null, { status: 202 });
			return new Response(rewriteFrame(await answered), { headers: { 'content-type': 'application/json' } });
		},
	});
	console.error(`[compat] fields=${FIELDS} listening on http://${hostname}:${port}/mcp`);
}

if (import.meta.main) {
	process.on('SIGTERM', () => process.exit(0));
	process.on('SIGINT', () => process.exit(0));
	const httpAt = process.argv.indexOf('--http');
	if (httpAt === -1) {
		console.error(`[compat] fields=${FIELDS} on stdio`);
		await serveStdio();
	} else {
		serveHttp(Number(process.argv[httpAt + 1] ?? 8790));
	}
}
