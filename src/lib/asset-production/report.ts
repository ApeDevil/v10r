/**
 * The asset report's shape: what a job hands back and keeps beside its GLB. Declared in the
 * core (types only) so a browser can read a report without importing server code; the server
 * domain (`#lib/server/asset-production`) is what fills it in.
 */
import type { AssetRequest } from '#lib/schemas/asset-production.ts';
import type { AssetDiagnostic } from './diagnostics.ts';
import type { AssetBudget, AssetStageId, EngineOutcome } from './engine.ts';
import type { MeshInspection } from './inspect.ts';

export type AssetEnvironmentId = 'in-process' | 'isolated-process';

/** What one run cost, as measured where it ran. Absent fields were not measurable there. */
export interface AssetRunMeasurements {
	totalMs: number;
	cpuUserMs?: number;
	cpuSystemMs?: number;
	/**
	 * Resident set of the process that ran it, sampled as the run ended, bytes. Not the peak:
	 * Linux carries `ru_maxrss` across fork and exec, so a child's "max RSS" reports its parent's.
	 */
	rssBytes?: number;
	heapUsedDeltaBytes?: number;
}

/** Who asked, PROV-DM style: a person, a program, or a model acting for someone. */
export interface AssetAgent {
	kind: 'human' | 'software' | 'ai';
	/** A role or program name — never an IP address or an email. */
	label: string;
	/** The account a software or AI agent acted for, when there is one. */
	onBehalfOf?: string;
}

export interface AssetDerivation {
	transform: string;
	requestDigest: string;
	derivationKey: string;
}

export const ASSET_REPORT_FORMAT = 1;
export const GLB_MEDIA_TYPE = 'model/gltf-binary';

export interface AssetReport {
	format: typeof ASSET_REPORT_FORMAT;
	jobId: string;
	outcome: EngineOutcome;
	request?: AssetRequest;
	derivation?: AssetDerivation;
	engine: { id: string; version: number; label: string };
	generator?: { id: string; version: number; label: string };
	environment: { id: AssetEnvironmentId; runtime: string; budget: AssetBudget };
	output?: {
		mediaType: typeof GLB_MEDIA_TYPE;
		bytes: number;
		sha256: string;
		vertices: number;
		triangles: number;
		meshes: number;
		materials: number;
		/** Set when a store kept it; `reused` means an identical asset was already there. */
		stored?: { store: string; key: string; kind: 'created' | 'reused' };
	};
	estimate?: { vertices: number; triangles: number };
	inspection?: MeshInspection;
	diagnostics: AssetDiagnostic[];
	measurements: AssetRunMeasurements & { stageMs: Partial<Record<AssetStageId, number>> };
	provenance: {
		entity?: { sha256: string };
		activity: { transform?: string; startedAt: string; endedAt: string };
		agent: AssetAgent;
	};
}
