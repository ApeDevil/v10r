#!/usr/bin/env bun
/**
 * Compile the `pim` CLI into one self-contained program per OS (dist/pim/), for office
 * machines with no Bun, no git and no copy of this repo. Each file carries the Bun runtime,
 * so it is large (~100 MB) and needs nothing else.
 *
 *   bun run pim:build              all targets
 *   bun run pim:build -- linux-x64 one target
 */
import { mkdirSync } from 'node:fs';

const TARGETS = {
	'windows-x64': 'pim.exe',
	'darwin-arm64': 'pim-macos-arm64',
	'darwin-x64': 'pim-macos-x64',
	'linux-x64': 'pim-linux-x64',
} as const;

const wanted = process.argv.slice(2);
const targets = Object.entries(TARGETS).filter(([t]) => wanted.length === 0 || wanted.includes(t));
if (targets.length === 0) {
	console.error(`Unknown target. Choose from: ${Object.keys(TARGETS).join(', ')}`);
	process.exit(2);
}

mkdirSync('dist/pim', { recursive: true });
for (const [target, file] of targets) {
	const proc = Bun.spawnSync(
		['bun', 'build', 'scripts/pim/sheet.ts', '--compile', `--target=bun-${target}`, '--outfile', `dist/pim/${file}`],
		{ stdout: 'inherit', stderr: 'inherit' },
	);
	if (proc.exitCode !== 0) process.exit(proc.exitCode ?? 1);
}
