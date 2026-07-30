/**
 * Stdio-side validate_snippet: the same per-line rule engine as the hosted
 * src/lib/server/mcp/snippet/ (never imported across the boundary — mcp/ stays
 * standalone), reading the shared mcp/snippet-rules.json from the read-only repo
 * mount, plus one stdio-only extra the hosted surface cannot offer: a
 * Bun.Transpiler syntax pre-check (a one-directional superset — the hosted
 * surface never emits `syntax-error`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_ROOT } from './security.ts';

type Language = 'svelte' | 'ts';

interface CompiledRule {
	id: string;
	severity: 'error' | 'warn';
	languages: string[];
	re: RegExp;
	skipIf: string[];
	message: string;
	fix: string;
	docs: string;
}

interface RuleSet {
	rules: CompiledRule[];
	maxSnippetChars: number;
	maxFindings: number;
	/** Human-visible degradation notes (e.g. app.css unreadable) — never silent. */
	degraded: string[];
}

export interface SnippetOutcome {
	ok: boolean;
	text: string;
}

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let cached: { root: string; set: RuleSet | null; error: string | null } | null = null;

function loadRuleSet(root: string): { set: RuleSet | null; error: string | null } {
	if (cached && cached.root === root) return cached;
	let set: RuleSet | null = null;
	let error: string | null = null;
	try {
		const raw = JSON.parse(readFileSync(join(root, 'mcp', 'snippet-rules.json'), 'utf8')) as {
			maxSnippetChars: number;
			maxFindings: number;
			rules: Array<Omit<CompiledRule, 're'> & { pattern: string; flags: string }>;
		};
		const degraded: string[] = [];
		let tokenAlternation = 'no-color-tokens-loaded';
		try {
			const css = readFileSync(join(root, 'src', 'app.css'), 'utf8');
			const tokens = new Set<string>();
			for (const match of css.matchAll(/--color-([a-z0-9-]+)\s*:/g)) tokens.add(match[1]);
			if (tokens.size > 0) {
				tokenAlternation = [...tokens]
					.sort((a, b) => b.length - a.length)
					.map(escapeRe)
					.join('|');
			}
		} catch {
			degraded.push('token-opacity rule skipped: src/app.css was not readable from the repo mount.');
		}
		set = {
			maxSnippetChars: raw.maxSnippetChars,
			maxFindings: raw.maxFindings,
			degraded,
			rules: raw.rules.map((rule) => ({
				id: rule.id,
				severity: rule.severity,
				languages: rule.languages,
				re: new RegExp(rule.pattern.replace('{{COLOR_TOKENS}}', tokenAlternation), rule.flags),
				skipIf: rule.skipIf,
				message: rule.message,
				fix: rule.fix,
				docs: rule.docs,
			})),
		};
	} catch (cause) {
		error = String(cause);
	}
	cached = { root, set, error };
	return cached;
}

/** Syntax pre-check via Bun's built-in transpiler. Svelte snippets are checked on their
 *  <script> blocks only — markup syntax is out of scope for a transpiler. */
function syntaxError(snippet: string, language: Language): string | null {
	const transpiler = new Bun.Transpiler({ loader: 'tsx' });
	const sources: string[] = [];
	if (language === 'ts') {
		sources.push(snippet);
	} else {
		for (const match of snippet.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
			sources.push(match[1]);
		}
	}
	for (const source of sources) {
		try {
			transpiler.transformSync(source);
		} catch (cause) {
			return String(cause);
		}
	}
	return null;
}

export function validateSnippetStdio(args: Record<string, unknown>, root: string = DEFAULT_ROOT): SnippetOutcome {
	const { set, error } = loadRuleSet(root);
	if (!set) {
		return { ok: false, text: `The snippet rule set failed to load: ${error ?? 'unknown error'}.` };
	}
	const snippet = typeof args.snippet === 'string' && args.snippet.length <= set.maxSnippetChars ? args.snippet : null;
	if (snippet === null || snippet.trim().length === 0) {
		return {
			ok: false,
			text: `"snippet" must be a non-empty string of at most ${set.maxSnippetChars} characters. Refused rather than truncated — a partially validated snippet reads as clean.`,
		};
	}
	const language: Language = args.language === 'ts' ? 'ts' : 'svelte';

	interface Finding {
		id: string;
		severity: 'error' | 'warn';
		line: number;
		column: number;
		message: string;
		fix: string;
		docs: string;
	}
	const findings: Finding[] = [];
	let truncated = false;

	// Stdio-only superset: a snippet that does not parse gets one syntax-error finding
	// before any convention check.
	const parseFailure = syntaxError(snippet, language);
	if (parseFailure !== null) {
		findings.push({
			id: 'syntax-error',
			severity: 'error',
			line: 1,
			column: 1,
			message: 'The snippet does not parse. (Stdio-only check — the hosted endpoint never emits this.)',
			fix: 'Fix the syntax error before convention checks can be meaningful.',
			docs: '/docs/stack/svelte.md',
		});
	}

	outer: for (const rule of set.rules) {
		if (!rule.languages.includes(language)) continue;
		const lines = snippet.split('\n');
		for (let index = 0; index < lines.length; index++) {
			const line = lines[index];
			if (rule.skipIf.some((marker) => line.includes(marker))) continue;
			rule.re.lastIndex = 0;
			const match = rule.re.exec(line);
			if (!match) continue;
			if (findings.length >= set.maxFindings) {
				truncated = true;
				break outer;
			}
			findings.push({
				id: rule.id,
				severity: rule.severity,
				line: index + 1,
				column: match.index + 1,
				message: rule.message,
				fix: rule.fix,
				docs: rule.docs,
			});
		}
	}
	findings.sort((a, b) => a.line - b.line || a.column - b.column || a.id.localeCompare(b.id));

	const lineCount = snippet.split('\n').length;
	if (findings.length === 0) {
		return {
			ok: true,
			text: [
				'No issues found — the snippet conforms to the checked v10r conventions.',
				'',
				'Note: this checks the mechanical conventions (runes, component-first, design tokens, Valibot). Re-run after any further edit.',
				...set.degraded.map((note) => `\nDegraded: ${note}`),
			].join('\n'),
		};
	}
	const errors = findings.filter((finding) => finding.severity === 'error').length;
	const body = findings.map((finding, index) =>
		[
			`${index + 1}. [${finding.severity}] ${finding.id} at ${finding.line}:${finding.column} — ${finding.message}`,
			`   Fix: ${finding.fix}`,
			`   Docs: https://www.v10r.dev${finding.docs}`,
		].join('\n'),
	);
	const footer = [
		truncated ? `Stopped at ${set.maxFindings} findings — fix these and resubmit for the rest.` : '',
		...set.degraded.map((note) => `Degraded: ${note}`),
		'Apply the fixes and call validate_snippet again; iterate until it reports clean.',
	].filter((line) => line.length > 0);
	return {
		ok: true,
		text: [
			`# validate_snippet: ${findings.length} issue(s) (${errors} error(s), ${findings.length - errors} warning(s)) in ${lineCount} line(s) of ${language}`,
			'',
			body.join('\n'),
			'',
			footer.join('\n'),
		].join('\n'),
	};
}
