/**
 * What a generator is: deterministic code that turns one validated parameter set into a
 * `GeneratedMesh`. It is the only engine-specific part a new object needs — the inspector,
 * the encoder, the quality gates and the job around it stay the same.
 */
import type { AssetDiagnostic } from '../diagnostics.ts';
import type { GeneratedMesh, MeshCost } from '../mesh.ts';

export interface AssetGenerator<Parameters> {
	/** Matches the request's `generator` discriminator. */
	id: string;
	/** Bumped whenever a code change can change an output byte; part of the derivation key. */
	version: number;
	label: string;
	/** Rules across parameters the schema's per-field bounds cannot express. Findings, never throws. */
	check(parameters: Parameters): AssetDiagnostic[];
	/** Exact counts `generate` will emit, computed without building anything: the budget gate's input. */
	estimate(parameters: Parameters): MeshCost;
	/** Calls `checkpoint` between units of work so a run can be cancelled or hit its deadline. */
	generate(parameters: Parameters, checkpoint: () => void): GeneratedMesh;
}
