#!/usr/bin/env bun
/**
 * Asset production from a terminal — the same job, report and store as the app.
 *
 *   bun run asset:produce example                       Print a valid request to start from.
 *   bun run asset:produce <request.json> --out <dir>    Run it; keep <dir>/<owner>/<derivation key>/{asset.glb,report.json}.
 *       --isolated      Run in a child worker process (hard deadline kill) instead of in this one.
 *       --owner <id>    Store namespace (default: local).
 *
 * Prints the report summary; exits 1 when the run did not succeed. A repeat run of the same
 * request reuses the kept asset; nothing is ever overwritten.
 */
import { readFileSync } from 'node:fs';
import { DEFAULT_ASSET_BUDGET } from '../../src/lib/asset-production/index.ts';
import { STRUCTURAL_RING_DEFAULTS } from '../../src/lib/schemas/asset-production.ts';
import { ISOLATED_RUN_MS } from '../../src/lib/server/asset-production/config.ts';
import {
	createDirectoryAssetStore,
	createIsolatedProcessEnvironment,
	inProcessEnvironment,
	runAssetJob,
	summariseAssetReport,
} from '../../src/lib/server/asset-production/index.ts';

const [command, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
	const at = rest.indexOf(name);
	return at === -1 ? undefined : rest[at + 1];
};

if (command === 'example') {
	console.log(
		JSON.stringify(
			{ format: 1, generator: 'structural-ring', label: 'Example ring', parameters: STRUCTURAL_RING_DEFAULTS },
			null,
			'\t',
		),
	);
	process.exit(0);
}
const out = flag('--out');
if (!command || !out) {
	console.error('usage: asset:produce example | asset:produce <request.json> --out <dir> [--isolated] [--owner <id>]');
	process.exit(2);
}

let input: unknown;
try {
	input = JSON.parse(readFileSync(command, 'utf8'));
} catch {
	console.error(`Cannot read a JSON request from ${command}.`);
	process.exit(2);
}

const { report } = await runAssetJob(input, {
	environment: rest.includes('--isolated') ? createIsolatedProcessEnvironment() : inProcessEnvironment,
	budget: DEFAULT_ASSET_BUDGET,
	runMs: ISOLATED_RUN_MS,
	owner: flag('--owner') ?? 'local',
	agent: { kind: 'software', label: 'asset:produce CLI' },
	jobId: `cli-${Date.now()}`,
	store: createDirectoryAssetStore(out),
});
console.log(summariseAssetReport(report));
process.exit(report.outcome === 'succeeded' ? 0 : 1);
