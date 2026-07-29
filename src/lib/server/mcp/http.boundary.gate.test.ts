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
	{ label: '@vercel/functions (platform edge — belongs in the route adapter)', re: /@vercel\/functions/ },
	{ label: '@upstash/* (Redis client)', re: /@upstash\// },
	{ label: '$lib/server/cache (Redis client)', re: /\$lib\/server\/cache\b/ },
];

function readProtocolFile(name: string): string {
	return readFileSync(join(process.cwd(), 'src', 'lib', 'server', 'mcp', name), 'utf8');
}

/**
 * `$lib/server/api/*` used to be banned as a whole directory. The reason given
 * was "pulls Upstash + $app/environment" — but that is a property of
 * `rate-limit.ts`, not of the directory, and a directory-shaped rule states the
 * wrong invariant. `api/body.ts` (bounded request readers) has no such edge and
 * the protocol layer has a real need for it.
 *
 * So the rule is now: an `$lib/server/api/*` import is allowed only if the
 * imported module — and everything it reaches inside that directory — is itself
 * free of the forbidden edges. VERIFIED, not trusted: if `api/body.ts` ever
 * acquires a Redis import, this test fails here, naming the boundary, instead of
 * surfacing as an unrelated Neon connection error inside a protocol test.
 *
 * This also narrows the "does not walk the graph" limit noted above — for this
 * one directory, it now does.
 */
const API_DIR = join(process.cwd(), 'src', 'lib', 'server', 'api');

function apiModulesReachableFrom(source: string, seen = new Set<string>()): string[] {
	const direct = [...source.matchAll(/from '\$lib\/server\/api\/([\w-]+)'/g)].map((match) => match[1]);
	const out: string[] = [];
	for (const name of direct) {
		if (seen.has(name)) continue;
		seen.add(name);
		out.push(name);
		const nested = readFileSync(join(API_DIR, `${name}.ts`), 'utf8');
		// Relative siblings inside the same directory count as reachable too.
		const relatives = [...nested.matchAll(/from '\.\/([\w-]+)'/g)].map((match) => match[1]);
		for (const relative of relatives) {
			if (seen.has(relative)) continue;
			seen.add(relative);
			out.push(relative);
		}
		out.push(...apiModulesReachableFrom(nested, seen));
	}
	return out;
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

	it('only reaches $lib/server/api modules that are themselves edge-free', () => {
		const reached = new Set<string>();
		for (const name of PROTOCOL_FILES) {
			for (const module of apiModulesReachableFrom(readProtocolFile(name))) reached.add(module);
		}
		// Sentinel: if the import is ever removed this set empties, and every
		// assertion below would pass by having nothing to check.
		expect([...reached].sort()).toEqual(['body', 'response']);

		for (const module of reached) {
			const src = readFileSync(join(API_DIR, `${module}.ts`), 'utf8');
			for (const { label, re } of FORBIDDEN) {
				expect(re.test(src), `$lib/server/api/${module}.ts imports ${label}`).toBe(false);
			}
		}
	});

	it('still refuses the rate limiter, which is the module the old blanket ban was really about', () => {
		for (const name of PROTOCOL_FILES) {
			expect(/\$lib\/server\/api\/rate-limit/.test(readProtocolFile(name)), `${name} imports the rate limiter`).toBe(
				false,
			);
		}
		// And the reason, asserted rather than asserted-about: it does carry the edge.
		expect(/\$lib\/server\/cache\b/.test(readFileSync(join(API_DIR, 'rate-limit.ts'), 'utf8'))).toBe(true);
	});

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
