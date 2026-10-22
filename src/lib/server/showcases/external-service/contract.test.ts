/**
 * The runtime mirrors and the client's operation table match the published contract — and
 * the drift check is proven to notice when they would not. Each mutation below is a
 * realistic incompatible change on the service side; every one must be reported, at the
 * path where it happened, or the check is decoration.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLASSIFIED_ERROR_STATUSES, SERVICE_OPERATIONS } from './client';
import { CONTRACT_MIRRORS, contractDrift } from './contract';

// biome-ignore lint/suspicious/noExplicitAny: the spec is mutated as untyped JSON on purpose — that is the test.
type Json = Record<string, any>;
const spec: Json = JSON.parse(readFileSync('services/order-rules/openapi.json', 'utf8'));

function mutated(change: (schemas: Json) => void): Json {
	const copy = structuredClone(spec);
	change(copy.components.schemas);
	return copy;
}

const variant = (union: Json, key: string, value: string) =>
	union.oneOf.find((v: Json) => v.properties?.[key]?.enum?.[0] === value);

describe('contract mirrors', () => {
	it('match openapi.json exactly', () => {
		expect(contractDrift(spec)).toEqual([]);
	});

	it.each<[string, string, (schemas: Json) => void]>([
		[
			'a response field removed',
			'EvaluateResponse<outcome=accepted>.finalState',
			(s) => {
				const accepted = variant(s.EvaluateResponse, 'outcome', 'accepted');
				delete accepted.properties.finalState;
				accepted.required = accepted.required.filter((k: string) => k !== 'finalState');
			},
		],
		[
			'a response field renamed',
			'StatusResponse.uptimeMs',
			(s) => {
				s.StatusResponse.properties.uptime = s.StatusResponse.properties.uptimeMs;
				delete s.StatusResponse.properties.uptimeMs;
				s.StatusResponse.required = s.StatusResponse.required.map((k: string) => (k === 'uptimeMs' ? 'uptime' : k));
			},
		],
		[
			'an enum value renamed',
			'finalState: values',
			(s) => {
				s.OrderState.enum = s.OrderState.enum.map((x: string) => (x === 'partially_paid' ? 'part_paid' : x));
			},
		],
		[
			'a required request field added',
			'EvaluateRequest.currency',
			(s) => {
				s.EvaluateRequest.properties.currency = { type: 'string' };
				s.EvaluateRequest.required.push('currency');
			},
		],
		['a request bound tightened', 'events: maxItems', (s) => (s.EvaluateRequest.properties.events.maxItems = 32)],
		[
			'a step constraint added',
			'totalCents: multipleOf',
			(s) => (s.EvaluateRequest.properties.totalCents.multipleOf = 100),
		],
		['uniqueness demanded', 'events: uniqueItems', (s) => (s.EvaluateRequest.properties.events.uniqueItems = true)],
		[
			'an exclusive bound added',
			'totalCents: exclusiveMaximum',
			(s) => (s.EvaluateRequest.properties.totalCents.exclusiveMaximum = 1000),
		],
		[
			'an event variant removed',
			'mirror has a variant the contract lacks (type=refund)',
			(s) => {
				s.EventInput.oneOf = s.EventInput.oneOf.filter((v: Json) => v.properties.type.enum[0] !== 'refund');
			},
		],
		[
			'a request reopened to unknown fields',
			'EvaluateRequest: closed',
			(s) => delete s.EvaluateRequest.additionalProperties,
		],
		['an error code added', 'code: values', (s) => s.ErrorCode.enum.push('rate_limited')],
		[
			'a field made nullable',
			'uptimeMs: contract type',
			(s) => (s.StatusResponse.properties.uptimeMs.type = ['integer', 'null']),
		],
		[
			'a keyword the check does not model',
			'keyword "allOf"',
			(s) => (s.StatusResponse.properties.release = { allOf: [{ type: 'string' }] }),
		],
		['a component removed', 'LiveResponse: no such component', (s) => delete s.LiveResponse],
	])('detect %s', (_, where, change) => {
		const drift = contractDrift(mutated(change));
		expect(
			drift.some((line) => line.includes(where)),
			drift.join('\n'),
		).toBe(true);
	});
});

describe('client operation table', () => {
	const ops = Object.values(SERVICE_OPERATIONS);
	const refName = (node: Json | undefined) => String(node?.$ref ?? '').replace('#/components/schemas/', '');

	it.each(ops)('$name: path, method and auth match the contract', (op) => {
		const declared = spec.paths[op.path]?.[op.method.toLowerCase()];
		expect(declared, `${op.method} ${op.path} is not in openapi.json`).toBeDefined();
		const secured = JSON.stringify(declared.security ?? []) === JSON.stringify([{ bearer: [] }]);
		expect(secured).toBe(op.authenticated);
	});

	it.each(ops)('$name: request and 200 response use the mirrored components', (op) => {
		const declared = spec.paths[op.path][op.method.toLowerCase()];
		const response = refName(declared.responses['200']?.content?.['application/json']?.schema);
		expect(CONTRACT_MIRRORS[response as keyof typeof CONTRACT_MIRRORS]).toBe(op.responseSchema);
		const request = refName(declared.requestBody?.content?.['application/json']?.schema);
		expect(request ? CONTRACT_MIRRORS[request as keyof typeof CONTRACT_MIRRORS] : null).toBe(op.requestSchema);
	});

	it.each(ops)('$name: every declared error status is one the client classifies, with the envelope', (op) => {
		const declared = spec.paths[op.path][op.method.toLowerCase()];
		for (const [status, response] of Object.entries(declared.responses as Record<string, Json>)) {
			if (status === '200') continue;
			expect(Object.keys(CLASSIFIED_ERROR_STATUSES), `${op.name} declares ${status}`).toContain(status);
			expect(refName(response.content?.['application/json']?.schema)).toBe('ErrorEnvelope');
		}
	});
});
