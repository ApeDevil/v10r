/**
 * The validate_snippet rule engine: deterministic, per-line regex checks against the
 * shared rule set. Pure functions over strings — no fs, no network, no clock — so the
 * hosted (Vercel) surface can run it unchanged.
 *
 * The report NEVER echoes snippet content — findings carry line:column only. The caller
 * already has the snippet; echoing it back would only create the reflection/amplification
 * surface the MCP layer's bounded-echo discipline exists to prevent, and it keeps the
 * output an order of magnitude below the 40 KB response bound even at MAX_FINDINGS.
 */
import { MAX_FINDINGS, SNIPPET_RULES, type SnippetLanguage, type SnippetRule, type SnippetSeverity } from './rules';

const DOCS_ORIGIN = 'https://www.v10r.dev';

export interface Finding {
	ruleId: string;
	severity: SnippetSeverity;
	line: number;
	column: number;
	message: string;
	fix: string;
	docs: string;
}

export interface SnippetReport {
	language: SnippetLanguage;
	lineCount: number;
	findings: Finding[];
	truncatedFindings: boolean;
}

export function validateSnippet(
	snippet: string,
	language: SnippetLanguage,
	rules: readonly SnippetRule[] = SNIPPET_RULES,
): SnippetReport {
	const lines = snippet.split('\n');
	const findings: Finding[] = [];
	let truncated = false;
	outer: for (const rule of rules) {
		if (!rule.languages.includes(language)) continue;
		for (let index = 0; index < lines.length; index++) {
			const line = lines[index];
			if (rule.skipIf.some((marker) => line.includes(marker))) continue;
			rule.re.lastIndex = 0;
			const match = rule.re.exec(line);
			if (!match) continue;
			if (findings.length >= MAX_FINDINGS) {
				truncated = true;
				break outer;
			}
			findings.push({
				ruleId: rule.id,
				severity: rule.severity,
				line: index + 1,
				column: match.index + 1,
				message: rule.message,
				fix: rule.fix,
				docs: rule.docs,
			});
		}
	}
	findings.sort((a, b) => a.line - b.line || a.column - b.column || a.ruleId.localeCompare(b.ruleId));
	return { language, lineCount: lines.length, findings, truncatedFindings: truncated };
}

export function renderReport(report: SnippetReport): string {
	const { findings } = report;
	if (findings.length === 0) {
		return [
			'No issues found — the snippet conforms to the checked v10r conventions.',
			'',
			'Note: this checks the mechanical conventions (runes, component-first, design tokens, Valibot). Re-run after any further edit.',
		].join('\n');
	}
	const errors = findings.filter((finding) => finding.severity === 'error').length;
	const warnings = findings.length - errors;
	const body = findings.map((finding, index) =>
		[
			`${index + 1}. [${finding.severity}] ${finding.ruleId} at ${finding.line}:${finding.column} — ${finding.message}`,
			`   Fix: ${finding.fix}`,
			`   Docs: ${DOCS_ORIGIN}${finding.docs}`,
		].join('\n'),
	);
	const footer = [
		report.truncatedFindings ? `Stopped at ${MAX_FINDINGS} findings — fix these and resubmit for the rest.` : '',
		'Apply the fixes and call validate_snippet again; iterate until it reports clean.',
	].filter((line) => line.length > 0);
	return [
		`# validate_snippet: ${findings.length} issue(s) (${errors} error(s), ${warnings} warning(s)) in ${report.lineCount} line(s) of ${report.language}`,
		'',
		body.join('\n'),
		'',
		footer.join('\n'),
	].join('\n');
}
