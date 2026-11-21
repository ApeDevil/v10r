/**
 * Run the official MCP conformance suite against a running v10r MCP endpoint, once per protocol
 * revision the server speaks, each against a committed expected-failures baseline.
 *
 *   bun run dev                                   # in another shell — this script starts nothing
 *   bun run mcp:conformance                       # both revisions against http://localhost:5173/api/mcp/public
 *   bun run mcp:conformance --revision 2026-07-28
 *   bun run mcp:conformance --url https://www.v10r.dev/api/mcp/public
 *
 * Deliberately NOT part of `bun run validate`: it needs a running server and the network (npx
 * fetches the pinned runner). The in-process SDK interop tests carry the regression protection
 * inside the gate; this lane is the spec authority, run in the monthly review and before a ship
 * that touches `src/lib/server/mcp/` or `mcp/` (docs/blueprint/architecture/mcp-evolution/process.md).
 *
 * The runner is pinned per revision. The baselines list ONLY scenarios that exercise a capability
 * v10r does not advertise, each with its reason; the runner also fails on a baseline entry that
 * starts passing, so a baseline can only shrink honestly. A new failure is a bug until the matrix
 * says why it is not applicable — never an entry added to make the run green.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '../..');

interface ConformanceLane {
	/** The pinned runner. 0.1.x is stable and covers 2025-11-25; only the 0.2 pre-release knows 2026-07-28. */
	runner: string;
	/** Scenario selection for the revision. */
	selection: string[];
	baseline: string;
}

const LANES: Record<string, ConformanceLane> = {
	'2025-11-25': {
		runner: '@modelcontextprotocol/conformance@0.1.16',
		selection: [],
		baseline: 'scripts/mcp/conformance/2025-11-25.baseline.yml',
	},
	'2026-07-28': {
		runner: '@modelcontextprotocol/conformance@0.2.0-alpha.12',
		selection: ['--requirements', '2026-07-28'],
		baseline: 'scripts/mcp/conformance/2026-07-28.baseline.yml',
	},
};

function argValue(flag: string): string | undefined {
	const index = process.argv.indexOf(flag);
	return index === -1 ? undefined : process.argv[index + 1];
}

const url = argValue('--url') ?? 'http://localhost:5173/api/mcp/public';
const only = argValue('--revision');
if (only !== undefined && !(only in LANES)) {
	console.error(`Unknown --revision ${only}. Known: ${Object.keys(LANES).join(', ')}`);
	process.exit(2);
}

const failed: string[] = [];
for (const [revision, lane] of Object.entries(LANES)) {
	if (only !== undefined && only !== revision) continue;
	console.log(`\n=== MCP conformance ${revision} (${lane.runner}) → ${url}`);
	const run = spawnSync(
		'npx',
		['-y', lane.runner, 'server', '--url', url, ...lane.selection, '--expected-failures', resolve(ROOT, lane.baseline)],
		{ stdio: 'inherit', cwd: ROOT },
	);
	if (run.status !== 0) failed.push(revision);
}

if (failed.length > 0) {
	console.error(`\nConformance failed for: ${failed.join(', ')}`);
	process.exit(1);
}
console.log('\nConformance: every revision matches its baseline.');
