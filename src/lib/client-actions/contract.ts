/**
 * Client action contract — what an agent may ask a client to do, and what the client may
 * answer. Framework-free and transport-free: both the server (which advertises a client
 * action to the model and reads its result back) and the client (which executes it) import
 * this module, and nothing in it knows about Svelte, the AI SDK or the Desk.
 *
 * A client action is a tool whose `executor` is `client` (`#lib/types/ai-tools.ts`): the
 * model calls it like any other tool, but the execution happens in the user's own browser,
 * against live interface state the server cannot reach. Three facts are kept apart on
 * purpose, because confusing them is how an agent reports work it never did:
 *
 *   requested  — the call left the server (a tool part reached the client)
 *   executed   — a registered handler ran
 *   confirmed  — the handler read the interface back and saw the intended state
 *
 * Only `completed` means all three. Every other status says which one is missing.
 *
 * A result is a claim made by the user's browser. It is data for the model — it never
 * authorizes anything. Consequential changes to stored data stay server tools behind the
 * approval gate (`docs/blueprint/ai/agent-actions.md`).
 */
import * as v from 'valibot';

/**
 * How a client action ended.
 *
 * - `completed`   — executed, and the intended state was observed afterwards.
 * - `failed`      — attempted, but the intended state was not observed (or the handler threw).
 * - `unavailable` — nothing was attempted: no handler is mounted, or the target is gone.
 * - `refused`     — nothing was attempted: the input or a precondition ruled it out.
 * - `timed_out`   — the handler did not settle in time; the interface state is unknown.
 */
export const CLIENT_ACTION_STATUSES = ['completed', 'failed', 'unavailable', 'refused', 'timed_out'] as const;

export type ClientActionStatus = (typeof CLIENT_ACTION_STATUSES)[number];

/** The longest `message` a result may carry — a result is a status report, not a channel. */
export const CLIENT_ACTION_MESSAGE_MAX_CHARS = 300;

/** The most facts `observed` may carry, and the longest any one of them may be. */
export const CLIENT_ACTION_OBSERVED_MAX_KEYS = 12;
export const CLIENT_ACTION_OBSERVED_VALUE_MAX_CHARS = 200;

const ObservedValue = v.union([
	v.pipe(v.string(), v.maxLength(CLIENT_ACTION_OBSERVED_VALUE_MAX_CHARS)),
	v.number(),
	v.boolean(),
	v.null(),
]);

/**
 * The result of one client action — the only shape a client may answer with, and the only
 * shape the server lets into a model's history for a client-executed tool. Strict and
 * bounded: an unknown key or an oversized value is a malformed result, not a bigger one.
 */
export const ClientActionResultSchema = v.strictObject({
	status: v.picklist(CLIENT_ACTION_STATUSES),
	/** Machine-readable reason, snake_case — `target_missing`, `unsaved_work`, `invalid_input`, … */
	code: v.optional(v.pipe(v.string(), v.regex(/^[a-z][a-z0-9_]{0,39}$/))),
	/** One short sentence for the model to relay. */
	message: v.optional(v.pipe(v.string(), v.maxLength(CLIENT_ACTION_MESSAGE_MAX_CHARS))),
	/** What the handler read back from the interface after acting — flat facts, no nesting. */
	observed: v.optional(
		v.pipe(
			v.record(v.pipe(v.string(), v.regex(/^[a-z][a-z0-9_]{0,39}$/)), ObservedValue),
			v.check((o) => Object.keys(o).length <= CLIENT_ACTION_OBSERVED_MAX_KEYS, 'Too many observed facts'),
		),
	),
});

export type ClientActionResult = v.InferOutput<typeof ClientActionResultSchema>;

/**
 * One client action, declared once and read by both sides: the server derives the
 * model-facing input schema from `input`, the client validates the call against the same
 * schema before a handler sees it.
 */
export interface ClientActionContract<TInput = unknown> {
	name: string;
	input: v.GenericSchema<unknown, TInput>;
	/** How long a handler may take before the call is reported `timed_out`. */
	timeoutMs: number;
}

/** The result a party reports when what it was handed is not a `ClientActionResult`. */
export const MALFORMED_CLIENT_ACTION_RESULT: ClientActionResult = {
	status: 'failed',
	code: 'malformed_result',
	message: 'The client reported a result that does not match the client action contract.',
};

/**
 * Read an untrusted value as a result. Anything that does not match the contract becomes
 * `MALFORMED_CLIENT_ACTION_RESULT` — a caller never has to handle "not a result".
 */
export function parseClientActionResult(value: unknown): ClientActionResult {
	const parsed = v.safeParse(ClientActionResultSchema, value);
	return parsed.success ? parsed.output : MALFORMED_CLIENT_ACTION_RESULT;
}
