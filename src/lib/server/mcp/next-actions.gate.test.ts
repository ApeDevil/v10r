/**
 * NEXT-ACTIONS CONVENTION GATE.
 *
 * The hosted side enforces the recovery-step contract at compile time (`errorResult`'s
 * required third parameter). The stdio side (`mcp/`) cannot be imported from src/ — that
 * is a hard boundary — so its half of the contract is pinned here as a static scan, the
 * house style for cross-boundary invariants (see docs/blueprint/security/gate-tests.md).
 *
 * Three properties:
 *  1. every `fail(` call in mcp/tools.ts passes an actions array — no error strands the caller;
 *  2. the heading literal matches the hosted one exactly — one grep-able anchor on both surfaces;
 *  3. the transport catch-all in mcp/server.ts stays bare, mirroring the hosted transport
 *     literals whose bareness is the telemetry discriminator.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NEXT_ACTIONS_HEADING } from './types';

const TOOLS_PATH = join(process.cwd(), 'mcp', 'tools.ts');
const SERVER_PATH = join(process.cwd(), 'mcp', 'server.ts');

/** Balanced-paren argument extraction for every `fail(` CALL (the definition is skipped). */
function failCallArgs(source: string): string[] {
	const calls: string[] = [];
	const re = /(?<!function )\bfail\(/g;
	let match = re.exec(source);
	while (match !== null) {
		let depth = 1;
		let i = match.index + match[0].length;
		while (i < source.length && depth > 0) {
			const ch = source[i];
			if (ch === '(') depth += 1;
			else if (ch === ')') depth -= 1;
			i += 1;
		}
		calls.push(source.slice(match.index + match[0].length, i - 1));
		match = re.exec(source);
	}
	return calls;
}

describe('next-actions gate (stdio mirror)', () => {
	const tools = readFileSync(TOOLS_PATH, 'utf8');
	const server = readFileSync(SERVER_PATH, 'utf8');

	it('every fail() call in mcp/tools.ts hands the caller an actions array', () => {
		const calls = failCallArgs(tools);
		expect(calls.length).toBeGreaterThan(10);
		for (const call of calls) {
			expect(call, `fail(${call.slice(0, 60)}…) is missing its actions array`).toMatch(/\[/);
		}
	});

	it('the heading literal matches the hosted convention exactly', () => {
		expect(tools).toContain(`NEXT_ACTIONS_HEADING = '${NEXT_ACTIONS_HEADING}'`);
	});

	it('the stdio transport catch-all stays bare, like the hosted transport literals', () => {
		expect(server).not.toContain(NEXT_ACTIONS_HEADING);
		expect(server).toContain('failed unexpectedly');
	});

	it('why-strings stay one short clause on both surfaces', () => {
		const hosted = readFileSync(join(process.cwd(), 'src', 'lib', 'server', 'mcp', 'patterns', 'registry.ts'), 'utf8');
		for (const source of [tools, hosted]) {
			for (const match of source.matchAll(/why: '([^']*)'/g)) {
				expect(match[1].length, match[1]).toBeLessThanOrEqual(120);
			}
		}
	});
});
