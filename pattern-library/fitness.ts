/**
 * The fitness block of a pattern card — what a reader needs to rule a pattern OUT before
 * reading how it works. One declaration, imported by both MCP runtimes (the stdio server by
 * relative path, the hosted one through `$patterns`), so the two cannot render it differently.
 * Framework-free and filesystem-free, like `schema.ts`.
 */
import type { PatternRecord } from './schema.ts';

/** Prerequisites, contraindications, alternatives — printed BEFORE the how on every card and plan step. */
export function fitnessLines(pattern: PatternRecord): string[] {
	return [
		pattern.requires.length > 0 ? `**Requires:** ${pattern.requires.join(', ')}` : '',
		pattern.avoid_when.length > 0 ? `**Avoid when:**\n${pattern.avoid_when.map((rule) => `- ${rule}`).join('\n')}` : '',
		pattern.alternatives.length > 0
			? `**Alternatives:**\n${pattern.alternatives.map((alt) => `- ${alt.approach} — prefer when ${alt.prefer_when}`).join('\n')}`
			: '',
	].filter((line) => line.length > 0);
}

/** The plan-wide prerequisite union: what the target project must run before step 1. */
export function requiresLine(patterns: PatternRecord[]): string {
	const needs = [...new Set(patterns.flatMap((pattern) => pattern.requires))];
	return needs.length > 0
		? `This plan requires: ${needs.join(', ')}. If the target project lacks one, drop or replace the step that needs it.`
		: 'This plan requires no infrastructure beyond the app runtime.';
}
