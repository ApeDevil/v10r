/**
 * End-to-end smoke test: spawns server.ts as a real subprocess, performs the MCP
 * handshake over stdio, exercises every tool (plus security negatives), and checks
 * the regression guards that only bite in a live client (forbidden tool-def fields,
 * oversized responses, EOF termination).
 *
 * Run: podman run --rm -v <repo>:/v10r:ro docker.io/oven/bun:1.3.12 bun /v10r/mcp/smoke.ts
 */
import { join } from 'node:path';

interface RpcReply {
	id?: number;
	result?: {
		protocolVersion?: string;
		serverInfo?: { name?: string };
		instructions?: string;
		tools?: Array<Record<string, unknown>>;
		content?: Array<{ type: string; text: string }>;
		isError?: boolean;
	};
	error?: { code: number; message: string };
}

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
	if (condition) {
		console.error(`PASS ${name}`);
	} else {
		failures += 1;
		console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
	}
}

const requests: string[] = [
	JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } }),
	JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
	JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
	JSON.stringify({
		jsonrpc: '2.0',
		id: 3,
		method: 'tools/call',
		params: { name: 'search_patterns', arguments: { query: 'approval gate for mutating AI tools' } },
	}),
	JSON.stringify({
		jsonrpc: '2.0',
		id: 4,
		method: 'tools/call',
		params: { name: 'get_pattern', arguments: { id: 'multi-client-core' } },
	}),
	JSON.stringify({
		jsonrpc: '2.0',
		id: 5,
		method: 'tools/call',
		params: { name: 'get_file_excerpt', arguments: { path: 'src/lib/server/jobs/index.ts', line_count: 20 } },
	}),
	JSON.stringify({
		jsonrpc: '2.0',
		id: 6,
		method: 'tools/call',
		params: { name: 'trace_capability', arguments: { capability: 'rag ingest' } },
	}),
	JSON.stringify({
		jsonrpc: '2.0',
		id: 7,
		method: 'tools/call',
		params: { name: 'recommend_emulation_plan', arguments: { capabilities: ['ai chat', 'design system'] } },
	}),
	JSON.stringify({
		jsonrpc: '2.0',
		id: 8,
		method: 'tools/call',
		params: { name: 'get_file_excerpt', arguments: { path: '../.env' } },
	}),
	JSON.stringify({
		jsonrpc: '2.0',
		id: 9,
		method: 'tools/call',
		params: { name: 'get_file_excerpt', arguments: { path: '../../etc/passwd' } },
	}),
	JSON.stringify({
		jsonrpc: '2.0',
		id: 10,
		method: 'tools/call',
		params: { name: 'get_pattern', arguments: { id: 'does-not-exist' } },
	}),
];

const child = Bun.spawn(['bun', join(import.meta.dir, 'server.ts')], {
	stdin: 'pipe',
	stdout: 'pipe',
	stderr: 'inherit',
});

child.stdin.write(`${requests.join('\n')}\n`);
await child.stdin.end();

const raw = await new Response(child.stdout).text();
const exitCode = await child.exited;

const replies = new Map<number, RpcReply>();
for (const line of raw.split('\n').filter((entry) => entry.trim().length > 0)) {
	check(`response line under 40KB`, line.length < 40 * 1024, `${line.length} bytes`);
	const parsed = JSON.parse(line) as RpcReply;
	if (typeof parsed.id === 'number') {
		replies.set(parsed.id, parsed);
	}
}

check('child exits 0 on stdin EOF', exitCode === 0, `exit ${exitCode}`);
check('exactly 10 responses (notification got none)', replies.size === 10, `${replies.size}`);

const init = replies.get(1)?.result;
check('initialize: serverInfo.name', init?.serverInfo?.name === 'v10r-patterns');
check('initialize: protocolVersion echoed', init?.protocolVersion === '2025-11-25');
check('initialize: non-empty instructions', (init?.instructions?.length ?? 0) > 100);

const tools = replies.get(2)?.result?.tools ?? [];
check('tools/list: exactly 5 tools', tools.length === 5, `${tools.length}`);
const FORBIDDEN = ['outputSchema', 'title', 'annotations'];
for (const tool of tools) {
	const bad = FORBIDDEN.filter((key) => key in tool);
	check(`tool ${String(tool.name)}: no Claude-Code-killer fields`, bad.length === 0, bad.join(','));
	check(
		`tool ${String(tool.name)}: has description+inputSchema`,
		typeof tool.description === 'string' && typeof tool.inputSchema === 'object',
	);
}

for (const id of [3, 4, 5, 6, 7]) {
	const result = replies.get(id)?.result;
	check(
		`tools/call #${id}: text content, no error`,
		result?.isError !== true && (result?.content?.[0]?.text.length ?? 0) > 0,
	);
}
check(
	'search finds approval gate',
	replies.get(3)?.result?.content?.[0]?.text.includes('deskbot-approval-gate') === true,
);
check(
	'plan is dependency-ordered (harness before surfaces)',
	(() => {
		const body = replies.get(7)?.result?.content?.[0]?.text ?? '';
		return body.indexOf('ai-tool-harness') < body.indexOf('ai-surfaces');
	})(),
);

for (const id of [8, 9, 10]) {
	const result = replies.get(id)?.result;
	check(
		`negative #${id}: isError with message`,
		result?.isError === true && (result?.content?.[0]?.text.length ?? 0) > 0,
	);
}

console.error(failures === 0 ? 'SMOKE OK' : `SMOKE FAILED: ${failures} assertion(s)`);
process.exit(failures === 0 ? 0 : 1);
