/**
 * What validation and refused operations report — data, never a thrown error.
 *
 * Every code describes visual or logical plausibility of the declared data: a port that is
 * open, two ports whose declared standard does not match, a mate that does not line up. None
 * is an engineering, hydraulic or electrical verdict, and no surface may present one as such.
 */
import type { PortMismatch } from './standards';

const SEVERITY = {
	'definition.missing': 'error',
	'composition.recursive': 'error',
	'coupling.unresolved': 'error',
	'coupling.self': 'error',
	'coupling.duplicate': 'error',
	'port.incompatible': 'error',
	'port.capacity': 'error',
	'port.open': 'info',
	'mate.misaligned': 'error',
	'conduit.unresolved': 'error',
	'conduit.mode': 'error',
	'conduit.duplicate': 'error',
	'passage.unresolved': 'error',
	'passage.self': 'error',
	'exposed-port.unresolved': 'error',
	'exposed-port.shared': 'error',
	// Raised only by a refused operation, never by validating a document.
	'id.duplicate': 'error',
	'occurrence.unresolved': 'error',
	'waypoint.unresolved': 'error',
} as const;

export type DiagnosticCode = keyof typeof SEVERITY;
export type DiagnosticSeverity = (typeof SEVERITY)[DiagnosticCode];

export interface CompositionDiagnostic {
	code: DiagnosticCode;
	severity: DiagnosticSeverity;
	/** Slash path to what the finding is about: `couplings/c-1`, `ports/unit-1/pump-1#in`, `definitions/pump/passages/0`. */
	subject: string;
	/** For `port.incompatible`: every rule the two ports break. */
	mismatches?: PortMismatch[];
}

export function diagnostic(code: DiagnosticCode, subject: string, mismatches?: PortMismatch[]): CompositionDiagnostic {
	return mismatches
		? { code, severity: SEVERITY[code], subject, mismatches }
		: { code, severity: SEVERITY[code], subject };
}

/** A stable order — by code, then subject — so a list of findings diffs cleanly and renders the same everywhere. */
export function sortDiagnostics(diagnostics: CompositionDiagnostic[]): CompositionDiagnostic[] {
	return diagnostics.sort((a, b) => compareText(a.code, b.code) || compareText(a.subject, b.subject));
}

/** Locale-independent string order. */
export const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
