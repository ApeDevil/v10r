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
	/**
	 * A generative surface compiled: some `render_surface` call returned `ok`. `maxAttempts`
	 * bounds the calls it took (refusals the model had to correct count as attempts).
	 */
	v.object({
		kind: v.literal('renders-valid-surface'),
		maxAttempts: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
	}),
	/** Some valid surface this turn rendered holds a component of this catalog type. */
	v.object({ kind: v.literal('renders-component'), component: v.pipe(v.string(), v.regex(/^[A-Z][A-Za-z]{1,40}$/)) }),
	/** A `render_surface` call updated a surface an earlier turn of the case showed (same id). */
	v.object({ kind: v.literal('updates-surface') }),
	/** Re-sending the turn's press verbatim (same event id) was refused as a duplicate — no second turn. */
	v.object({ kind: v.literal('refuses-repeated-press') }),
	v.object({ kind: v.literal('outcome'), is: v.picklist(['ok', 'error', 'cancelled', 'awaiting_decision']) }),
]);

/**
 * A scripted next turn in the same conversation: either typed text, or a Button press on the
 * surface the thread shows last — the Button declaring `event`, pressed after the user set
 * `values` (data-model path → value). `resend` re-sends the press verbatim afterwards, the way
 * a network retry would, so `refuses-repeated-press` can grade the server's answer.
 */
export const FollowUpSchema = v.pipe(
	v.object({
		question: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(2000))),
		press: v.optional(
			v.object({
				event: v.optional(v.pipe(v.string(), v.regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/))),
				values: v.optional(v.record(v.pipe(v.string(), v.startsWith('/')), v.unknown())),
				resend: v.optional(v.boolean()),
			}),
		),
		expect: v.pipe(v.array(ExpectationSchema), v.minLength(1)),
	}),
	v.check((f) => (f.question === undefined) !== (f.press === undefined), 'a follow-up is a question or a press'),
);

export const EvalCaseSchema = v.object({
	id: v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/)),
	surface: v.picklist(['chatbot', 'deskbot']),
	question: v.pipe(v.string(), v.minLength(1), v.maxLength(2000)),
	/** Extra request fields the surface needs (the deskbot's `toolScopes`). */
	request: v.optional(v.object({ toolScopes: v.optional(v.array(v.string())) })),
	expect: v.pipe(v.array(ExpectationSchema), v.minLength(1)),
	/** Scripted next turns in the same conversation (chatbot only), each graded on its own turn. */
	followUps: v.optional(v.pipe(v.array(FollowUpSchema), v.maxLength(3))),
	/** Why the case exists — the regression it guards. */
	note: v.optional(v.string()),
});

export const GoldenSetSchema = v.object({
	note: v.optional(v.string()),
	cases: v.pipe(v.array(EvalCaseSchema), v.minLength(1)),
});

export type Expectation = v.InferOutput<typeof ExpectationSchema>;
export type EvalCase = v.InferOutput<typeof EvalCaseSchema>;
export type FollowUp = v.InferOutput<typeof FollowUpSchema>;
export type GoldenSet = v.InferOutput<typeof GoldenSetSchema>;
