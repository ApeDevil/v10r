#!/usr/bin/env bun
/**
 * Re-record the committed scenario results.
 *
 *   podman exec v10r bun run perf:scenarios
 *
 * Unlike `snapshot.ts` this cannot import the harness and call it. The scenarios drive
 * the REAL cache and resilience modules, those reach `$env/dynamic/private`, and that
 * specifier only exists inside Vite — bare Bun cannot resolve it. The alternative was a
 * harness restricted to the modules that happen to avoid `$env`, which would measure a
 * convenient subset of the system and present it as the system.
 *
 * So the harness runs where the module graph exists, and this is the door: it spawns the
 * gate in write mode. The gate is the same file either way, which is what stops the
 * recorded numbers and the asserted numbers from being produced by two different paths.
 */

const GATE = 'src/lib/server/perf/scenarios.gate.test.ts';

const child = Bun.spawn(['bunx', 'vitest', 'run', '--project', 'unit', GATE], {
	env: { ...process.env, PERF_WRITE_SCENARIOS: '1' },
	stdout: 'inherit',
	stderr: 'inherit',
});

process.exit(await child.exited);
