/**
 * Execution environments: where an engine run happens, and what it costs there. The engine
 * and the request are the same in every one; what changes is isolation and measurement.
 *
 * - `in-process` — the calling process (a serverless function, the CLI). Bounded by the
 *   budget checked before generation and by cooperative checkpoints; cannot be killed
 *   separately from its host. CPU time is the process's, so concurrent requests blur it.
 * - `isolated-process` — a child process per run (`isolated-process.ts`): its own heap, a
 *   hard wall-clock kill, a capped output, no inherited secrets. The same entrypoint is what
 *   a container image would run; a container adds the memory and network limits.
 *
 * A GPU environment would be a third implementation of this interface. None is built: no
 * operation here needs one.
 */
import type { AssetBudget, AssetEnvironmentId, AssetRunMeasurements, EngineRun } from '#lib/asset-production/index.ts';

export interface AssetEnvironmentRun {
	run: EngineRun;
	measurements: AssetRunMeasurements;
	runtime: string;
}

export interface AssetExecutionContext {
	budget: AssetBudget;
	/** Wall-clock budget for the whole run, milliseconds. */
	runMs: number;
	signal?: AbortSignal;
}

export interface AssetExecutionEnvironment {
	id: AssetEnvironmentId;
	execute(input: unknown, context: AssetExecutionContext): Promise<AssetEnvironmentRun>;
}

/** `bun 1.3.12` or `node 22.x` — what actually executed the engine. */
export function runtimeLabel(): string {
	const versions = process.versions as Record<string, string | undefined>;
	return versions.bun ? `bun ${versions.bun}` : `node ${process.versions.node}`;
}
