/**
 * Findings of an asset production run, as data. Every stage reports through these — a
 * refused request, a mesh that fails a check, a GLB that does not read back — and none of
 * them throws for a finding. Severity is fixed per code so a caller cannot soften one.
 */

export const ASSET_DIAGNOSTIC_SEVERITY = {
	// Request: refused before any geometry is built.
	'request.invalid': 'error',
	'request.unknown-generator': 'error',
	'parameter.conflict': 'error',
	'budget.triangles': 'error',
	'budget.vertices': 'error',
	// Mesh inspection.
	'mesh.empty': 'error',
	'mesh.non-finite': 'error',
	'mesh.index-out-of-range': 'error',
	'mesh.degenerate-triangle': 'error',
	'mesh.open-shell': 'error',
	'mesh.inverted-shell': 'error',
	'mesh.outside-envelope': 'error',
	'mesh.normal-not-unit': 'warning',
	'mesh.estimate-mismatch': 'warning',
	// Export and read-back.
	'budget.bytes': 'error',
	'glb.malformed': 'error',
	// Execution.
	'run.cancelled': 'error',
	'run.deadline': 'error',
	'run.failed': 'error',
	'store.conflict': 'error',
} as const satisfies Record<string, 'error' | 'warning' | 'info'>;

export type AssetDiagnosticCode = keyof typeof ASSET_DIAGNOSTIC_SEVERITY;
export type AssetDiagnosticSeverity = (typeof ASSET_DIAGNOSTIC_SEVERITY)[AssetDiagnosticCode];

export interface AssetDiagnostic {
	code: AssetDiagnosticCode;
	severity: AssetDiagnosticSeverity;
	/** What it is about: a parameter name, a primitive name, `request`. */
	subject: string;
	/** One English sentence for a developer or an agent; UIs key their own copy off `code`. */
	message: string;
}

export function assetDiagnostic(code: AssetDiagnosticCode, subject: string, message: string): AssetDiagnostic {
	return { code, severity: ASSET_DIAGNOSTIC_SEVERITY[code], subject, message };
}

export const hasAssetErrors = (diagnostics: readonly AssetDiagnostic[]) =>
	diagnostics.some((diagnostic) => diagnostic.severity === 'error');
