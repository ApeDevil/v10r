/**
 * The generative surface action — the one thing a rendered surface can send back: a user
 * pressed a Button, and here is the event the Button named, with its context resolved against
 * the surface's data model at that moment (A2UI v1.0 `action`).
 *
 * A surface action is an *event*, never an *effect*. Its risk is `view`: rendering a surface
 * and editing its fields change nothing outside the browser, and pressing a Button only
 * reports that it was pressed. The surface never executes a write, and nothing in the
 * renderer may turn an action into one.
 *
 * Any action that implies a write ("save these requirements", "create the project", "delete
 * the draft") reaches the server as data for the model. The server — never the browser —
 * turns it into an ordinary tool call from `TOOL_MANIFEST`, and that call goes through the
 * approval gate like any other (`docs/blueprint/ai/agent-actions.md`). An action's context is
 * user input, so it reaches the model as untrusted content: a Button labelled "Approve" is not
 * an approval, for the same reason a client action result is not one.
 */
import * as v from 'valibot';
import { GENERATIVE_SURFACE_LIMITS as LIMITS } from './limits.ts';
import { SURFACE_ACTION_PART, type SurfaceActionRecord } from './surface-action-key.ts';

/** What a surface action may change: nothing outside the surface. */
export const GENERATIVE_SURFACE_ACTION_RISK = 'view' as const;

const Identifier = v.pipe(v.string(), v.regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/));

export const GenerativeSurfaceActionSchema = v.strictObject({
	surfaceId: Identifier,
	/** The event name the Button declared. */
	name: v.pipe(v.string(), v.regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/)),
	/** The id of the Button that was pressed. */
	sourceComponentId: v.pipe(v.string(), v.regex(/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/)),
	/** The Button's context, bindings resolved. Bounded below by `toGenerativeSurfaceAction`. */
	context: v.record(v.string(), v.unknown()),
});

export type GenerativeSurfaceAction = v.InferOutput<typeof GenerativeSurfaceActionSchema>;

export type GenerativeSurfaceActionReading =
	| { ok: true; action: GenerativeSurfaceAction }
	| { ok: false; reason: 'malformed' | 'context_too_large' };

/**
 * Read a raw action (web_core's `ActionPayload`, or a body posted back to the server) into a
 * bounded `GenerativeSurfaceAction`. Unknown fields — web_core's `timestamp`, `catalogId`,
 * `metadata` — are dropped rather than forwarded: the model needs the event, not the envelope.
 */
export function toGenerativeSurfaceAction(raw: unknown): GenerativeSurfaceActionReading {
	if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'malformed' };
	const { surfaceId, name, sourceComponentId, context } = raw as Record<string, unknown>;
	const parsed = v.safeParse(GenerativeSurfaceActionSchema, {
		surfaceId,
		name,
		sourceComponentId,
		context: context ?? {},
	});
	if (!parsed.success) return { ok: false, reason: 'malformed' };
	const action = parsed.output;
	const keys = Object.keys(action.context).length;
	const json = JSON.stringify(action.context);
	if (keys > LIMITS.maxActionContextKeys || new TextEncoder().encode(json).length > LIMITS.maxActionContextBytes) {
		return { ok: false, reason: 'context_too_large' };
	}
	// A JSON round trip leaves plain data only: no functions, prototypes or shared references
	// from the live data model travel with the action.
	return { ok: true, action: { ...action, context: JSON.parse(json) } };
}

/**
 * The schema of a press as the thread records it (`SurfaceActionRecord`, in
 * `surface-action-key.ts`): the action, the render it was pressed on and the event id the
 * browser minted for the press.
 */
export const SurfaceActionRecordSchema = v.strictObject({
	action: GenerativeSurfaceActionSchema,
	renderId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
	eventId: v.pipe(v.string(), v.uuid()),
});

/** The record an untrusted message part carries, or null when it is not a valid surface action part. */
export function surfaceActionRecordOf(part: unknown): SurfaceActionRecord | null {
	if (typeof part !== 'object' || part === null) return null;
	const { type, data } = part as Record<string, unknown>;
	if (type !== SURFACE_ACTION_PART) return null;
	const parsed = v.safeParse(SurfaceActionRecordSchema, data);
	if (!parsed.success) return null;
	const bounded = toGenerativeSurfaceAction(parsed.output.action);
	return bounded.ok ? { ...parsed.output, action: bounded.action } : null;
}
