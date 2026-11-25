/**
 * Reading a peer's review report. A peer is an independent implementation with its own rules,
 * so its codes are its own: they are kept as strings and never mapped onto a local
 * `FindingCode`, and a remote finding never passes for one of ours.
 *
 * Fail-closed per entry: each finding is rebuilt from the known fields only (an unknown key is
 * dropped, never copied), and an entry with a missing, mistyped or oversized required field is
 * dropped and counted. A report that is not a report at all — wrong envelope, or more findings
 * than the limit — is refused whole, because a cut list would misstate what the peer said.
 */
import { FINDING_SEVERITIES, type FindingSeverity } from '#patterns/architecture-engineering/index.ts';
import { A2A_CLIENT_LIMITS } from './config.ts';
import { REVIEW_REPORT_FORMAT } from './review-report.ts';

/** One finding as a peer claims it. */
export interface RemoteFinding {
	code: string;
	severity: FindingSeverity;
	subject: string;
	detected: string;
	category?: string;
	why?: string;
	fix?: string;
}

export type RemoteFindingsRead =
	| { ok: true; findings: RemoteFinding[]; dropped: number }
	| { ok: false; message: string };

const CODE = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const MAX_CODE = 64;
const MAX_SUBJECT = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, max: number): string | null {
	return typeof value === 'string' && value.trim().length > 0 && value.length <= max ? value : null;
}

function readFinding(entry: unknown): RemoteFinding | null {
	if (!isRecord(entry)) return null;
	const code =
		typeof entry.code === 'string' && entry.code.length <= MAX_CODE && CODE.test(entry.code) ? entry.code : null;
	const severity = (FINDING_SEVERITIES as readonly unknown[]).includes(entry.severity)
		? (entry.severity as FindingSeverity)
		: null;
	const subject = boundedText(entry.subject, MAX_SUBJECT);
	const detected = boundedText(entry.detected, A2A_CLIENT_LIMITS.findingText);
	if (!code || !severity || !subject || !detected) return null;

	const finding: RemoteFinding = { code, severity, subject, detected };
	for (const key of ['category', 'why', 'fix'] as const) {
		if (entry[key] === undefined) continue;
		const max = key === 'category' ? MAX_CODE : A2A_CLIENT_LIMITS.findingText;
		const text = boundedText(entry[key], max);
		if (text === null) return null;
		finding[key] = text;
	}
	return finding;
}

export function readRemoteFindings(data: unknown): RemoteFindingsRead {
	if (!isRecord(data)) return { ok: false, message: 'the data part is not an object' };
	if (data.format !== REVIEW_REPORT_FORMAT) {
		return { ok: false, message: `unsupported report format ${String(data.format).slice(0, 20)}` };
	}
	if (!Array.isArray(data.findings)) return { ok: false, message: 'the report has no findings list' };
	if (data.findings.length > A2A_CLIENT_LIMITS.findings) {
		return {
			ok: false,
			message: `the report has ${data.findings.length} findings; at most ${A2A_CLIENT_LIMITS.findings}`,
		};
	}
	const findings: RemoteFinding[] = [];
	let dropped = 0;
	for (const entry of data.findings) {
		const finding = readFinding(entry);
		if (finding) findings.push(finding);
		else dropped++;
	}
	return { ok: true, findings, dropped };
}
