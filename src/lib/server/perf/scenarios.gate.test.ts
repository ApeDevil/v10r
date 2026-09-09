/**
 * SCENARIO GATE — and the door the committed results are written through.
 *
 * The harness needs the application's module graph: it drives the real cache and
 * resilience modules, and those reach `$env/dynamic/private`, which only Vite resolves.
 * That is why the runner is a test rather than a plain Bun script the way
 * `scripts/perf/snapshot.ts` is — `scripts/perf/scenarios.ts` spawns this file with
 * `PERF_WRITE_SCENARIOS=1`. A harness restricted to the modules that happen to avoid
 * `$env` would measure a convenient subset and call it the system.
 *
 * What is asserted is the deterministic half only: origin calls and the outcome string.
 * Latency is written to the file and never compared — on a shared CI host it measures
 * the host, and a gate that fails for that reason is a gate that gets muted.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { committedScenarios, compareScenarios, runScenarios, SCENARIO_IDS, type ScenarioRun } from './scenarios';

// No Redis, always. A lab measurement that depends on whether the developer happens to
// have Upstash credentials in their environment is two different measurements sharing
// a name — and every mechanism here has a defined in-process path without it.
vi.mock('$lib/server/cache/client', () => ({ redis: null }));
vi.mock('$lib/server/http/after-response', () => ({ deferAfterResponse: vi.fn() }));

const OUT = join(process.cwd(), 'src', 'lib', 'server', 'perf', 'scenarios.json');
const WRITING = process.env.PERF_WRITE_SCENARIOS === '1';

let fresh: ScenarioRun;

describe('performance scenarios', () => {
	beforeAll(async () => {
		fresh = await runScenarios();
		if (WRITING) {
			writeFileSync(OUT, `${JSON.stringify(fresh, null, '\t')}\n`);
			console.log(`[scenarios] wrote ${fresh.results.length} results to ${OUT}`);
			for (const r of fresh.results) {
				console.log(`  ${r.id.padEnd(30)} ${String(r.originCalls).padStart(3)} origin  ${r.latencyMs}ms  ${r.outcome}`);
			}
		}
	});

	it('runs every declared scenario', () => {
		expect(fresh.results.map((r) => r.id)).toEqual([...SCENARIO_IDS]);
	});

	it('was measured without a shared cache tier', () => {
		expect(fresh.sharedTier).toBe(false);
	});

	it('has a committed result for every scenario', () => {
		// A scenario added and never committed would otherwise be compared against
		// nothing and pass forever. Skipped while writing: the import was resolved from
		// the file this run is replacing.
		if (WRITING) return;
		expect(committedScenarios.results.map((r) => r.id).sort()).toEqual([...SCENARIO_IDS].sort());
	});

	it('matches the committed deterministic columns', () => {
		if (WRITING) return;
		const drifted = compareScenarios(fresh).filter((d) => d.changed);

		expect(
			drifted,
			`Scenario behaviour changed:\n${drifted
				.map(
					(d) =>
						`  ${d.id}: committed ${d.committed ? `${d.committed.originCalls} origin / ${d.committed.outcome}` : '(absent)'} ` +
						`→ now ${d.fresh.originCalls} origin / ${d.fresh.outcome}`,
				)
				.join('\n')}\nIf the change is deliberate, re-record it: podman exec v10r bun run perf:scenarios`,
		).toEqual([]);
	});

	it('bounds a hanging dependency well below the time it would have taken', () => {
		// The one timing claim worth asserting, because it is an order of magnitude and
		// not a few milliseconds: the caller waits for the slice, not for the dependency.
		const slow = fresh.results.find((r) => r.id === 'slow-dependency');
		expect(slow?.outcome).toBe('deadline-exceeded');
		expect(slow?.latencyMs).toBeLessThan(200);
	});
});
