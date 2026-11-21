/**
 * The v10r stdio pattern server with tool metadata added on the way out — a TEST FIXTURE for the
 * Claude Code compatibility check (roadmap B1), never a registration anyone keeps.
 *
 * It runs the real `mcp/server.ts` dispatch unchanged and only rewrites `tools/list` results
 * (both eras), adding the fields the check is about:
 *   V10R_COMPAT_FIELDS=none          control — byte-identical to the real server
 *   V10R_COMPAT_FIELDS=title         `title` on every tool
 *   V10R_COMPAT_FIELDS=readOnlyHint  `annotations: { readOnlyHint: true }` on every tool (true: all eight are read-only)
 *   V10R_COMPAT_FIELDS=both          both
 *
 *   bun scripts/mcp/claude-code-compat/annotated-server.ts               # stdio
 *   bun scripts/mcp/claude-code-compat/annotated-server.ts --http 8790   # POST http://127.0.0.1:8790/mcp
 *
 * The real server's tool definitions stay free of these fields until the check passes on a
 * current Claude Code (pattern-mcp.md §Client design constraints). Runbook:
 * docs/blueprint/architecture/mcp-evolution/claude-code-compat.md.
 */
import { createLineBuffer } from '../../../mcp/protocol.ts';
import { dispatchLine } from '../../../mcp/server.ts';

type Fields = 'none' | 'title' | 'readOnlyHint' | 'both';

const FIELDS = (process.env.V10R_COMPAT_FIELDS ?? 'none') as Fields;
if (!['none', 'title', 'readOnlyHint', 'both'].includes(FIELDS)) {
	console.error(`[compat] unknown V10R_COMPAT_FIELDS=${FIELDS}`);
	process.exit(2);
}

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
export function rewriteFrame(frame: string | null): string | null {
	if (frame === null || FIELDS === 'none') return frame;
	const reply = JSON.parse(frame) as { result?: { tools?: Array<Record<string, unknown>> } };
	if (!Array.isArray(reply.result?.tools)) return frame;
	reply.result.tools = reply.result.tools.map(annotate);
	return `${JSON.stringify(reply)}\n`;
}

async function serveStdio(): Promise<void> {
	const decoder = new TextDecoder('utf-8');
	const lines = createLineBuffer();
	const write = (frame: string | null) => {
		if (frame !== null) process.stdout.write(frame);
	};
	for await (const chunk of Bun.stdin.stream()) {
		for (const line of lines.push(decoder.decode(chunk, { stream: true }))) write(rewriteFrame(dispatchLine(line)));
	}
	for (const line of lines.flush()) write(rewriteFrame(dispatchLine(line)));
}

function serveHttp(port: number): void {
	// 0.0.0.0 only inside a container, where the port is published to the host's loopback.
	const hostname = process.env.V10R_COMPAT_HOST ?? '127.0.0.1';
	Bun.serve({
		hostname,
		port,
		async fetch(request) {
			if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
			const frame = rewriteFrame(dispatchLine(await request.text()));
			if (frame === null) return new Response(null, { status: 202 });
			return new Response(frame, { headers: { 'content-type': 'application/json' } });
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
		process.exit(0);
	}
	serveHttp(Number(process.argv[httpAt + 1] ?? 8790));
}
