/**
 * The review report: what a review artifact's JSON data part carries, in both directions. v10r's
 * agent writes it from `checkSecurity` / `checkArchitecture`; a peer specialist (the Python
 * performance agent in `scripts/a2a/peer/`) writes the same envelope with its own finding codes.
 *
 * The envelope is fixed; the codes inside are the producer's own. A reader therefore never maps
 * a remote code onto a local `FindingCode` — see `remote-findings.ts`.
 */
import {
	type ArchitectureFinding,
	type ArchitectureModel,
	checkArchitecture,
	checkSecurity,
	countBySeverity,
	type FindingSeverity,
} from '#patterns/architecture-engineering/index.ts';
import type { ReviewSkillId } from './agent-card.ts';

/** The persisted shape number of a review report (as `ArchitectureModel.format`). */
export const REVIEW_REPORT_FORMAT = 1;

export interface ReviewReport {
	format: typeof REVIEW_REPORT_FORMAT;
	skill: ReviewSkillId;
	model: { id: string; name: string };
	counts: Record<FindingSeverity, number>;
	findings: ArchitectureFinding[];
}

export function buildReviewReport(skill: ReviewSkillId, model: ArchitectureModel): ReviewReport {
	const findings = skill === 'architecture-security-review' ? checkSecurity(model) : checkArchitecture(model);
	return {
		format: REVIEW_REPORT_FORMAT,
		skill,
		model: { id: model.id, name: model.name },
		counts: countBySeverity(findings),
		findings,
	};
}

/** One line for the artifact's text part and the completed status message. */
export function summarizeReviewReport(report: ReviewReport): string {
	const { error, warning, unknown, recommendation } = report.counts;
	const total = report.findings.length;
	return `${report.skill} of "${report.model.name}": ${total} finding${total === 1 ? '' : 's'} (${error} error, ${warning} warning, ${unknown} unknown, ${recommendation} recommendation).`;
}
