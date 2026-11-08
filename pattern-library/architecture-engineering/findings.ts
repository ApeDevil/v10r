/**
 * What an engineering check reports — data, never a thrown error, and never a measurement.
 *
 * Severity is fixed per code, so the same problem is always classified the same way:
 *   - `error`: the model states facts that contradict a rule (a secret on a browser node);
 *   - `warning`: a heuristic that usually signals a problem — not a definitive failure;
 *   - `recommendation`: a simpler or safer shape exists;
 *   - `unknown`: the model leaves a property unstated that decides whether there is a problem.
 *
 * Category keeps security findings apart from runtime, communication, data and structure, so
 * a security problem is never hidden among cosmetic ones.
 */
export const FINDING_SPECS = {
	'secret.client-exposed': { severity: 'error', category: 'security' },
	'boundary.unauthenticated': { severity: 'error', category: 'security' },
	'boundary.auth-unknown': { severity: 'unknown', category: 'security' },
	'client.direct-data-access': { severity: 'error', category: 'security' },
	'main-thread.cpu': { severity: 'warning', category: 'runtime' },
	'request.long-running': { severity: 'warning', category: 'runtime' },
	'runtime.unsupported': { severity: 'error', category: 'runtime' },
	'protocol.incompatible': { severity: 'error', category: 'communication' },
	'boundary.failure-unknown': { severity: 'unknown', category: 'communication' },
	'boundary.no-failure-handling': { severity: 'warning', category: 'communication' },
	'boundary.unjustified-service': { severity: 'recommendation', category: 'structure' },
	'data.shared-ownership': { severity: 'warning', category: 'data' },
	'node.isolated': { severity: 'recommendation', category: 'structure' },
} as const satisfies Record<string, { severity: FindingSeverity; category: FindingCategory }>;

export type FindingSeverity = 'error' | 'warning' | 'recommendation' | 'unknown';
export type FindingCategory = 'security' | 'runtime' | 'communication' | 'data' | 'structure';
export type FindingCode = keyof typeof FINDING_SPECS;

export const FINDING_SEVERITIES: readonly FindingSeverity[] = ['error', 'warning', 'unknown', 'recommendation'];

export interface ArchitectureFinding {
	code: FindingCode;
	severity: FindingSeverity;
	category: FindingCategory;
	/** Slash path to what it is about: `nodes/browser-app`, `connections/browser-app-to-relational-db`. */
	subject: string;
	/** What was detected. */
	detected: string;
	/** Why it matters. */
	why: string;
	/** The architectural constraint it relates to. */
	constraint: string;
	/** Suggested corrections. */
	fix: string;
	/** Registry patterns that show the corrected shape. */
	patterns: string[];
}

export function finding(
	code: FindingCode,
	subject: string,
	text: Pick<ArchitectureFinding, 'detected' | 'why' | 'constraint' | 'fix' | 'patterns'>,
): ArchitectureFinding {
	return { code, ...FINDING_SPECS[code], subject, ...text };
}

const SEVERITY_RANK: Record<FindingSeverity, number> = { error: 0, warning: 1, unknown: 2, recommendation: 3 };

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** A stable order — severity, then code, then subject — so a list of findings diffs cleanly. */
export function sortFindings(findings: ArchitectureFinding[]): ArchitectureFinding[] {
	return findings.sort(
		(a, b) =>
			SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || compare(a.code, b.code) || compare(a.subject, b.subject),
	);
}

export function countBySeverity(findings: readonly ArchitectureFinding[]): Record<FindingSeverity, number> {
	const counts: Record<FindingSeverity, number> = { error: 0, warning: 0, recommendation: 0, unknown: 0 };
	for (const entry of findings) counts[entry.severity]++;
	return counts;
}
