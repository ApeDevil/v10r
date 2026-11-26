/**
 * `v10r-implementation-report/1` — the structured block a coding agent ends its report with,
 * pasted by the admin into the feedback detail page (Slice 2, docs/blueprint/feedback/
 * request-driven-development.md §R.6). Untrusted input: it is only read, validated against
 * this schema and stored as plain data; unknown keys are refused, text is length-bounded and
 * stripped of invisible controls, and nothing in it is executed or rendered as markup.
 *
 * What it says about validation is the agent's claim — reported evidence, not something
 * this application verified.
 */
import * as v from 'valibot';
import { extractTaggedBlock, stripInvisibleControls, type TaggedBlockRefusal } from './tagged-block';

export const IMPLEMENTATION_REPORT_FORMAT = 'v10r-implementation-report/1';

export const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

const text = (max: number) =>
	v.pipe(v.string(), v.transform(stripInvisibleControls), v.trim(), v.minLength(1), v.maxLength(max));

const checkResult = v.picklist(['passed', 'failed', 'not_run']);

export const RELEASE_RECOMMENDATIONS = ['release', 'do_not_release', 'needs_decision'] as const;

export const implementationReportSchema = v.strictObject({
	format: v.literal(IMPLEMENTATION_REPORT_FORMAT),
	feedbackId: v.pipe(v.string(), v.maxLength(64)),
	branch: v.pipe(v.string(), v.maxLength(120)),
	headSha: v.pipe(v.string(), v.toLowerCase(), v.regex(GIT_SHA_PATTERN)),
	approvedScope: text(2000),
	/** True when the agent stopped because the work exceeds the approved scope. */
	scopeExceeded: v.boolean(),
	summary: text(4000),
	validation: v.strictObject({
		validate: checkResult,
		validateBuild: checkResult,
		browser: v.picklist(['passed', 'failed', 'not_run', 'not_applicable']),
		notes: v.optional(text(2000)),
	}),
	performance: text(1500),
	security: text(1500),
	databaseChanges: text(1500),
	externalConsumption: text(1500),
	limitations: text(1500),
	recommendation: v.picklist(RELEASE_RECOMMENDATIONS),
});

export type ImplementationReport = v.InferOutput<typeof implementationReportSchema>;

export type ImplementationReportRefusal = TaggedBlockRefusal | 'invalid_report' | 'wrong_feedback' | 'wrong_branch';

export type ParsedImplementationReport =
	| { ok: true; report: ImplementationReport }
	| { ok: false; refusal: ImplementationReportRefusal; issues?: string[] };

/** Read the one report block from a paste and check it belongs to this item and branch. */
export function parseImplementationReport(
	paste: string,
	expected: { feedbackId: string; branch: string },
): ParsedImplementationReport {
	const block = extractTaggedBlock(paste, IMPLEMENTATION_REPORT_FORMAT);
	if (!block.ok) return { ok: false, refusal: block.refusal };
	const parsed = v.safeParse(implementationReportSchema, block.value);
	if (!parsed.success) {
		return {
			ok: false,
			refusal: 'invalid_report',
			issues: parsed.issues.slice(0, 5).map((issue) => `${v.getDotPath(issue) ?? '(root)'}: ${issue.message}`),
		};
	}
	if (parsed.output.feedbackId !== expected.feedbackId) return { ok: false, refusal: 'wrong_feedback' };
	if (parsed.output.branch !== expected.branch) return { ok: false, refusal: 'wrong_branch' };
	return { ok: true, report: parsed.output };
}
