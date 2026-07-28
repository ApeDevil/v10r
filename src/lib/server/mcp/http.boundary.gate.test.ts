import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ARCHITECTURE GATE — the MCP protocol layer must stay free of persistence and platform edges.
 *
 * `http.test.ts` and `sdk-interop.test.ts` deliberately contain ZERO `vi.mock` calls: they import
 * `http.ts` statically and drive the real production path. That only works while nothing reachable
 * from `http.ts` touches `$lib/server/db` — which executes `new Pool(...)` at module load — or
 * Redis, or `@vercel/functions`. The moment one of those edges appears, two protocol test files
 * start constructing a real Neon pool, and the failure reads as an unrelated connection error
 * rather than as the boundary violation it is.
 *
 * This gate replaces the weaker convention it grew out of ("keep these files byte-identical"),
 * which was really protecting the import list, not the bytes. Editing the code here is free;
 * acquiring a module edge is not.
 *
 * HONEST LIMIT: this proves the forbidden specifiers are absent from the SOURCE TEXT of these two
 * files. It does not walk the transitive graph, so a newly-added dependency-free-looking module
 * that itself imports the DB would slip through. If that becomes a real risk, the fix is a real
 * graph walk, not more regexes here.
 */
const PROTOCOL_FILES = ['http.ts', 'transport.ts', 'types.ts'];

const FORBIDDEN: Array<{ label: string; re: RegExp }> = [
	{ label: '$lib/server/db (constructs a Neon pool at module load)', re: /\$lib\/server\/db\b/ },
	{ label: '$lib/server/api/* (pulls Upstash + $app/environment)', re: /\$lib\/server\/api\// },
	{ label: '@vercel/functions (platform edge — belongs in the route adapter)', re: /@vercel\/functions/ },
	{ label: '@upstash/* (Redis client)', re: /@upstash\// },
	{ label: '$lib/server/cache (Redis client)', re: /\$lib\/server\/cache\b/ },
];

function readProtocolFile(name: string): string {
	return readFileSync(join(process.cwd(), 'src', 'lib', 'server', 'mcp', name), 'utf8');
}

describe('MCP protocol layer import boundary', () => {
	// Sentinel: a typo in the path would otherwise make every assertion below vacuously pass.
	it('reads all protocol files', () => {
		expect(PROTOCOL_FILES.length).toBeGreaterThan(0);
		for (const name of PROTOCOL_FILES) {
			expect(readProtocolFile(name).length, `${name} should not be empty`).toBeGreaterThan(0);
		}
	});

	for (const name of PROTOCOL_FILES) {
		describe(name, () => {
			for (const { label, re } of FORBIDDEN) {
				it(`does not import ${label}`, () => {
					expect(re.test(readProtocolFile(name)), `matched ${re}`).toBe(false);
				});
			}
		});
	}

	it('keeps types.ts free of ALL imports (it is the zero-import leaf)', () => {
		// Everything else in the MCP tree may import types.ts, so an import here is the one edge that
		// can reach every other module at once.
		const src = readProtocolFile('types.ts');
		expect(/^\s*import\s/m.test(src), 'types.ts must not import anything').toBe(false);
		expect(/\brequire\(/.test(src)).toBe(false);
	});

	it('never mints or reads an Mcp-Session-Id', () => {
		// Sessions are a deliberate non-feature: the dominant client does not echo the header, caches
		// a stale id across restarts, and the next protocol revision removes the mechanism entirely.
		// Minting one would turn every deploy into a hard break for connected clients.
		for (const name of PROTOCOL_FILES) {
			expect(/mcp-session-id/i.test(readProtocolFile(name)), `${name} references a session id`).toBe(false);
		}
	});
});
