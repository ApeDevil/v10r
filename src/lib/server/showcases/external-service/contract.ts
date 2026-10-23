/**
 * Runtime validation of the service contract — the last link of the chain:
 *
 *   contract.rs ─▶ openapi.json ─▶ contract.generated.ts (types) ─▶ these schemas (runtime)
 *
 * TypeScript types vanish at runtime, and a response is untrusted input however typed the
 * caller is, so the adapter validates what it sends and what it accepts. These valibot
 * schemas mirror the generated types, and two checks keep the mirror from drifting:
 *
 * 1. Compile time — the `Exact<…>` assertions below fail `svelte-check` the moment a
 *    schema's output type and the generated type disagree in any field.
 * 2. Runtime — `contractDrift` compares each schema's JSON Schema with the matching
 *    component in `openapi.json` (names, required, enums, bounds, closed objects), and
 *    `contract.test.ts` proves it catches deliberately broken specs.
 *
 * Requests are closed (`strictObject`), as the service is. Responses are open (`object`):
 * a field the service adds later is ignored — additive change stays compatible — while a
 * removed or renamed field fails validation, and the drift test before that.
 */
import { toJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import type { components } from '$lib/showcases/external-service/contract.generated';

type Schemas = components['schemas'];

const MAX_AMOUNT_CENTS = 100_000_000;
const MAX_EVENTS = 64;

const amountCents = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(MAX_AMOUNT_CENTS));
const count = v.pipe(v.number(), v.integer(), v.minValue(0));
const orderState = v.picklist(['placed', 'partially_paid', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded']);
const eventType = v.picklist(['pay', 'ship', 'deliver', 'cancel', 'refund']);

export const EventInputSchema = v.variant('type', [
	v.strictObject({ type: v.literal('pay'), amountCents }),
	v.strictObject({ type: v.literal('ship') }),
	v.strictObject({ type: v.literal('deliver') }),
	v.strictObject({ type: v.literal('cancel') }),
	v.strictObject({ type: v.literal('refund'), amountCents }),
]);

export const EvaluateRequestSchema = v.strictObject({
	totalCents: amountCents,
	events: v.pipe(v.array(EventInputSchema), v.minLength(1), v.maxLength(MAX_EVENTS)),
});

const step = v.object({ index: count, event: eventType, from: orderState, to: orderState });
const refusal = v.object({
	index: count,
	event: eventType,
	state: orderState,
	reason: v.picklist(['not_allowed_in_state', 'payment_incomplete', 'exceeds_balance']),
});

export const EvaluateResponseSchema = v.variant('outcome', [
	v.object({
		outcome: v.literal('accepted'),
		steps: v.array(step),
		finalState: orderState,
		paidCents: count,
		refundedCents: count,
	}),
	v.object({
		outcome: v.literal('refused'),
		steps: v.array(step),
		refusal,
		paidCents: count,
		refundedCents: count,
	}),
]);

export const LiveResponseSchema = v.object({ status: v.picklist(['live']) });

export const StatusResponseSchema = v.object({
	service: v.string(),
	release: v.string(),
	uptimeMs: count,
	operations: v.array(v.picklist(['evaluate'])),
	limits: v.object({ maxEvents: count, maxAmountCents: count, maxBodyBytes: count }),
});

export const ErrorEnvelopeSchema = v.object({
	error: v.object({
		code: v.picklist([
			'invalid_request',
			'unauthorized',
			'not_found',
			'method_not_allowed',
			'payload_too_large',
			'timeout',
		]),
		message: v.string(),
	}),
});

// ── Compile-time pins: each mirror's output type IS the generated type ───────────────

/** True only when A and B are mutually identical (including optionality). */
type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Pin<T extends true> = T;

export type ContractPins = [
	Pin<Exact<v.InferOutput<typeof EvaluateRequestSchema>, Schemas['EvaluateRequest']>>,
	Pin<Exact<v.InferOutput<typeof EventInputSchema>, Schemas['EventInput']>>,
	Pin<Exact<v.InferOutput<typeof EvaluateResponseSchema>, Schemas['EvaluateResponse']>>,
	Pin<Exact<v.InferOutput<typeof LiveResponseSchema>, Schemas['LiveResponse']>>,
	Pin<Exact<v.InferOutput<typeof StatusResponseSchema>, Schemas['StatusResponse']>>,
	Pin<Exact<v.InferOutput<typeof ErrorEnvelopeSchema>, Schemas['ErrorEnvelope']>>,
];

/** The mirror for each component of `openapi.json` that crosses the boundary. */
export const CONTRACT_MIRRORS = {
	EvaluateRequest: EvaluateRequestSchema,
	EvaluateResponse: EvaluateResponseSchema,
	LiveResponse: LiveResponseSchema,
	StatusResponse: StatusResponseSchema,
	ErrorEnvelope: ErrorEnvelopeSchema,
} as const;

// ── Runtime drift check ─────────────────────────────────────────────────────────────

type JsonSchema = Record<string, unknown>;

function resolve(spec: JsonSchema, node: JsonSchema): JsonSchema {
	const ref = node.$ref;
	if (typeof ref !== 'string') return node;
	const name = ref.replace('#/components/schemas/', '');
	const components = (spec.components as { schemas: Record<string, JsonSchema> }).schemas;
	return resolve(spec, components[name] ?? {});
}

/** Enum values of a node: `enum`, or valibot's `const` for a literal. */
function enumOf(node: JsonSchema): string[] | null {
	if (Array.isArray(node.enum)) return [...(node.enum as string[])].sort();
	if (node.const !== undefined) return [String(node.const)];
	return null;
}

/** The discriminating literal of a union member, used to pair spec and mirror variants. */
function discriminant(spec: JsonSchema, node: JsonSchema): string {
	const properties = (resolve(spec, node).properties ?? {}) as Record<string, JsonSchema>;
	for (const [key, property] of Object.entries(properties)) {
		const values = enumOf(resolve(spec, property));
		if (values?.length === 1) return `${key}=${values[0]}`;
	}
	return '?';
}

/** Constraint keywords compared value-for-value between contract and mirror. */
const BOUNDS = [
	'minimum',
	'maximum',
	'exclusiveMinimum',
	'exclusiveMaximum',
	'multipleOf',
	'minItems',
	'maxItems',
	'uniqueItems',
	'minLength',
	'maxLength',
	'pattern',
] as const;

/**
 * Every keyword the comparison understands. A contract node using any other keyword is
 * reported as drift instead of passing unexamined: a check that silently skips what it
 * cannot read would let exactly the novel breaking change through.
 */
const MODELLED_KEYWORDS = new Set<string>([
	...BOUNDS,
	'$ref',
	'type',
	'format',
	'description',
	'title',
	'properties',
	'required',
	'additionalProperties',
	'items',
	'enum',
	'const',
	'oneOf',
	'anyOf',
	'$schema',
]);

function compare(
	spec: JsonSchema,
	expected: JsonSchema,
	actual: JsonSchema,
	path: string,
	drift: string[],
	closedMatters: boolean,
): void {
	const want = resolve(spec, expected);
	const got = actual;
	for (const keyword of Object.keys(want)) {
		if (!MODELLED_KEYWORDS.has(keyword))
			drift.push(`${path}: contract keyword "${keyword}" is not checked by contractDrift`);
	}
	if (Array.isArray(want.type))
		drift.push(`${path}: contract type ${JSON.stringify(want.type)} (nullable?) has no mirror rule`);

	const wantVariants = (want.oneOf ?? want.anyOf) as JsonSchema[] | undefined;
	const gotVariants = (got.oneOf ?? got.anyOf) as JsonSchema[] | undefined;
	if (wantVariants || gotVariants) {
		const byKey = (variants: JsonSchema[] | undefined) =>
			new Map((variants ?? []).map((variant) => [discriminant(spec, variant), variant]));
		const wantByKey = byKey(wantVariants);
		const gotByKey = byKey(gotVariants);
		for (const key of new Set([...wantByKey.keys(), ...gotByKey.keys()])) {
			const w = wantByKey.get(key);
			const g = gotByKey.get(key);
			if (!w) drift.push(`${path}: mirror has a variant the contract lacks (${key})`);
			else if (!g) drift.push(`${path}: contract variant ${key} has no mirror`);
			else compare(spec, w, g, `${path}<${key}>`, drift, closedMatters);
		}
		return;
	}

	const wantEnum = enumOf(want);
	const gotEnum = enumOf(got);
	if (wantEnum || gotEnum) {
		if (JSON.stringify(wantEnum) !== JSON.stringify(gotEnum)) {
			drift.push(
				`${path}: values ${JSON.stringify(wantEnum)} in the contract, ${JSON.stringify(gotEnum)} in the mirror`,
			);
		}
		return;
	}

	for (const bound of BOUNDS) {
		if (want[bound] !== got[bound]) {
			drift.push(`${path}: ${bound} ${String(want[bound])} in the contract, ${String(got[bound])} in the mirror`);
		}
	}

	if (want.type === 'array' || got.type === 'array') {
		compare(spec, (want.items ?? {}) as JsonSchema, (got.items ?? {}) as JsonSchema, `${path}[]`, drift, closedMatters);
		return;
	}

	if (want.type === 'object' || got.type === 'object') {
		const wantProps = (want.properties ?? {}) as Record<string, JsonSchema>;
		const gotProps = (got.properties ?? {}) as Record<string, JsonSchema>;
		const wantRequired = new Set((want.required ?? []) as string[]);
		const gotRequired = new Set((got.required ?? []) as string[]);
		for (const key of new Set([...Object.keys(wantProps), ...Object.keys(gotProps)])) {
			if (!(key in gotProps)) drift.push(`${path}.${key}: in the contract, missing from the mirror`);
			else if (!(key in wantProps)) drift.push(`${path}.${key}: in the mirror, missing from the contract`);
			else if (wantRequired.has(key) !== gotRequired.has(key)) drift.push(`${path}.${key}: required differs`);
			else compare(spec, wantProps[key], gotProps[key], `${path}.${key}`, drift, closedMatters);
		}
		const wantClosed = want.additionalProperties === false;
		const gotClosed = got.additionalProperties === false;
		if (closedMatters && wantClosed !== gotClosed) {
			drift.push(`${path}: closed to unknown fields in ${wantClosed ? 'the contract' : 'the mirror'} only`);
		}
		return;
	}

	const scalar = (node: JsonSchema) => (node.type === 'integer' ? 'integer' : node.type);
	if (scalar(want) !== scalar(got)) {
		drift.push(`${path}: type ${String(want.type)} in the contract, ${String(got.type)} in the mirror`);
	}
}

/**
 * Every difference between the published contract and the runtime mirrors, as readable
 * paths. Empty means the adapter validates exactly what the service promises. Closed-ness
 * is compared for requests only: response mirrors are open on purpose (see the header).
 */
export function contractDrift(spec: JsonSchema): string[] {
	const drift: string[] = [];
	const components = (spec.components as { schemas?: Record<string, JsonSchema> } | undefined)?.schemas ?? {};
	for (const [name, mirror] of Object.entries(CONTRACT_MIRRORS)) {
		if (!components[name]) {
			drift.push(`${name}: no such component in the contract`);
			continue;
		}
		const actual = toJsonSchema(mirror, { errorMode: 'ignore' }) as JsonSchema;
		compare(spec, { $ref: `#/components/schemas/${name}` }, actual, name, drift, name.endsWith('Request'));
	}
	return drift;
}
