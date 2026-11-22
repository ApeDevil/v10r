/**
 * End-to-end smoke test: spawns the stdio server as a real subprocess — through the registered
 * entry (`server.ts`, which starts the bundle), the bundle itself (`server.bundle.js`) and the
 * source (`stdio-server.ts`) — performs the MCP handshake, exercises every
 * tool (plus security negatives), and checks the regression guards that only bite in a live client
 * (forbidden tool-def fields, oversized responses, EOF termination).
 *
 * The official SDK pins the protocol era per stdio connection, as a real client does, so each
 * entry is driven over two connections: a 2025-11-25 session and a 2026-07-28 one.
 *
 * Run: podman run --rm -v <repo>:/v10r:ro docker.io/oven/bun:1.3.12 bun /v10r/mcp/smoke.ts
 * (outside the container, point the tools at the clone: V10R_ROOT=$PWD bun mcp/smoke.ts)
 */
import { existsSync } from 'node:fs';
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

const MODERN_ENVELOPE = {
	'io.modelcontextprotocol/protocolVersion': '2026-07-28',
	'io.modelcontextprotocol/clientCapabilities': {},
};

const legacyRequests: string[] = [
	JSON.stringify({
		jsonrpc: '2.0',
		id: 1,
		method: 'initialize',
		params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'v10r-smoke', version: '1.0.0' } },
	}),
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
	JSON.stringify({
		jsonrpc: '2.0',
		id: 11,
		method: 'tools/call',
		params: {
			name: 'validate_snippet',
			arguments: { language: 'svelte', snippet: '<script>\nexport let value;\n</script>\n<button>go</button>' },
		},
	}),
];

// The 2026-07-28 era on its own connection: no handshake, the envelope travels in every request.
const modernRequests: string[] = [
	JSON.stringify({ jsonrpc: '2.0', id: 12, method: 'server/discover', params: { _meta: MODERN_ENVELOPE } }),
	JSON.stringify({ jsonrpc: '2.0', id: 13, method: 'tools/list', params: { _meta: MODERN_ENVELOPE } }),
];

/**
 * One stdio connection: write the requests, read until every request has its answer, then close
 * stdin and expect a clean exit. Stdin stays open until the answers are in — the SDK, per the stdio
 * binding, aborts requests still in flight at EOF.
 */
async function session(
	command: string[],
	requests: string[],
): Promise<{ replies: Map<number, RpcReply>; exitCode: number }> {
	const expected = requests.filter((request) => 'id' in JSON.parse(request)).length;
	const child = Bun.spawn(command, { stdin: 'pipe', stdout: 'pipe', stderr: 'inherit' });
	child.stdin.write(`${requests.join('\n')}\n`);
	await child.stdin.flush();

	const replies = new Map<number, RpcReply>();
	const decoder = new TextDecoder();
	let buffered = '';
	for await (const chunk of child.stdout) {
		buffered += decoder.decode(chunk, { stream: true });
		const lines = buffered.split('\n');
		buffered = lines.pop() ?? '';
		for (const line of lines.filter((entry) => entry.trim().length > 0)) {
			check('response line under 40KB', line.length < 40 * 1024, `${line.length} bytes`);
			const parsed = JSON.parse(line) as RpcReply;
			if (typeof parsed.id === 'number') replies.set(parsed.id, parsed);
		}
		if (replies.size >= expected) break;
	}
	await child.stdin.end();
	const exitCode = await Promise.race([child.exited, Bun.sleep(5_000).then(() => -1)]);
	if (exitCode === -1) child.kill();
	return { replies, exitCode };
}

/**
 * What to spawn. By default the three local entries; the source entry only where node_modules is
 * installed (inside the bare container it is not, by design). `V10R_SMOKE_SPAWN` replaces the list
 * with the one command a real client runs — `scripts/mcp/container-smoke.sh` passes
 * `podman|docker run -i --rm --network=none -v …:/v10r:ro … bun /v10r/mcp/server.ts`, so the
 * server runs in the container and the protocol crosses the container's stdio.
 */
const hasNodeModules = existsSync(join(import.meta.dir, '..', 'node_modules', '@modelcontextprotocol', 'server'));
const spawnOverride = process.env.V10R_SMOKE_SPAWN;
const commands: Array<[string, string[]]> = spawnOverride
	? [[spawnOverride, spawnOverride.split(' ').filter((part) => part.length > 0)]]
	: ['server.ts', 'server.bundle.js', ...(hasNodeModules ? ['stdio-server.ts'] : [])].map(
			(file): [string, string[]] => [file, ['bun', join(import.meta.dir, file)]],
		);

for (const [label, command] of commands) {
	console.error(`--- ${label}`);
	const legacy = await session(command, legacyRequests);
	const modern = await session(command, modernRequests);
	check('child exits 0 on stdin EOF (2025-11-25 session)', legacy.exitCode === 0, `exit ${legacy.exitCode}`);
	check('child exits 0 on stdin EOF (2026-07-28 session)', modern.exitCode === 0, `exit ${modern.exitCode}`);
	check('exactly 11 responses (notification got none)', legacy.replies.size === 11, `${legacy.replies.size}`);
	check('exactly 2 modern responses', modern.replies.size === 2, `${modern.replies.size}`);
	verify(new Map([...legacy.replies, ...modern.replies]));
}

function verify(replies: Map<number, RpcReply>): void {
	const init = replies.get(1)?.result;
	check('initialize: serverInfo.name', init?.serverInfo?.name === 'v10r-patterns');
	check('initialize: protocolVersion echoed', init?.protocolVersion === '2025-11-25');
	check('initialize: non-empty instructions', (init?.instructions?.length ?? 0) > 100);

	const tools = replies.get(2)?.result?.tools ?? [];
	check('tools/list: exactly 8 tools', tools.length === 8, `${tools.length}`);
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
		check(
			`negative #${id}: hands the caller a next step`,
			replies.get(id)?.result?.content?.[0]?.text.includes('## Next actions') === true,
		);
	}

	// validate_snippet: findings are a SUCCESS (no isError), and the dirty fixture must
	// trip both the Svelte-4 prop rule and the component-first rule.
	const snippetReport = replies.get(11)?.result;
	check('validate_snippet: findings without isError', snippetReport?.isError !== true);
	check(
		'validate_snippet: flags export let and raw button',
		(snippetReport?.content?.[0]?.text.includes('svelte4-export-let') ?? false) &&
			(snippetReport?.content?.[0]?.text.includes('raw-element') ?? false),
		snippetReport?.content?.[0]?.text.slice(0, 120),
	);

	const discover = replies.get(12)?.result as Record<string, unknown> | undefined;
	check(
		'server/discover: modern revision advertised',
		JSON.stringify(discover?.supportedVersions) === '["2026-07-28"]' && discover?.resultType === 'complete',
	);
	const modernList = replies.get(13)?.result as { tools?: unknown[]; resultType?: string; ttlMs?: number } | undefined;
	check(
		'modern tools/list: same 8 tools, marked complete, with a TTL',
		modernList?.tools?.length === 8 && modernList.resultType === 'complete' && typeof modernList.ttlMs === 'number',
	);
	check(
		'modern tools/list: tool definitions byte-identical to the legacy list',
		JSON.stringify(modernList?.tools) === JSON.stringify(replies.get(2)?.result?.tools),
	);
}

console.error(failures === 0 ? 'SMOKE OK' : `SMOKE FAILED: ${failures} assertion(s)`);
process.exit(failures === 0 ? 0 : 1);
