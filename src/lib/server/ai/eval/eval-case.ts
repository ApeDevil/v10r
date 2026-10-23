/**
 * The golden set's shape: one eval case is a question for one surface and the facts its
 * recorded turn must show. Every expectation is a deterministic check over the turn trace
 * and the answer text — no model judges another here, so a case means the same thing on
 * every run and a failure names the exact fact that broke.
 *
 * Alias-free (`scripts/ai/eval.ts` loads it under bare Bun by relative path).
 */
import * as v from 'valibot';

const ToolName = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9_]*$/));

export const ExpectationSchema = v.variant('kind', [
	/** No citation names a path the turn never surfaced (recalled from training, not grounded). */
	v.object({ kind: v.literal('cites-only-surfaced') }),
	/** Some citation points at this path (or a path under it). */
	v.object({ kind: v.literal('cites'), path: v.pipe(v.string(), v.startsWith('/')) }),
	/** The answer cites nothing — what an honest "I don't know" looks like in the trace. */
	v.object({ kind: v.literal('no-citations') }),
	v.object({ kind: v.literal('calls-tool'), tool: ToolName }),
	/** At least one of these ran — for a question several tools answer equally well. */
	v.object({ kind: v.literal('calls-any-tool'), tools: v.pipe(v.array(ToolName), v.minLength(1)) }),
	v.object({ kind: v.literal('never-calls'), tools: v.pipe(v.array(ToolName), v.minLength(1)) }),
	/** Every phrase appears in the answer, case-insensitive. */
	v.object({ kind: v.literal('answer-includes'), phrases: v.pipe(v.array(v.string()), v.minLength(1)) }),
	/** No phrase appears in the answer, case-insensitive. */
	v.object({ kind: v.literal('answer-excludes'), phrases: v.pipe(v.array(v.string()), v.minLength(1)) }),
	/** The deskbot stopped on a proposal instead of mutating. */
	v.object({ kind: v.literal('stops-at-approval') }),
	v.object({ kind: v.literal('outcome'), is: v.picklist(['ok', 'error', 'cancelled', 'awaiting_decision']) }),
]);

export const EvalCaseSchema = v.object({
	id: v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/)),
	surface: v.picklist(['chatbot', 'deskbot']),
	question: v.pipe(v.string(), v.minLength(1), v.maxLength(2000)),
	/** Extra request fields the surface needs (the deskbot's `toolScopes`). */
	request: v.optional(v.object({ toolScopes: v.optional(v.array(v.string())) })),
	expect: v.pipe(v.array(ExpectationSchema), v.minLength(1)),
	/** Why the case exists — the regression it guards. */
	note: v.optional(v.string()),
});

export const GoldenSetSchema = v.object({
	note: v.optional(v.string()),
	cases: v.pipe(v.array(EvalCaseSchema), v.minLength(1)),
});

export type Expectation = v.InferOutput<typeof ExpectationSchema>;
export type EvalCase = v.InferOutput<typeof EvalCaseSchema>;
export type GoldenSet = v.InferOutput<typeof GoldenSetSchema>;
