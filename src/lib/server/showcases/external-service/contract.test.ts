/**
 * The runtime mirrors match the published contract — and the drift check is proven to
 * notice when they would not. Each mutation below is a realistic incompatible change on
 * the service side; every one must be reported, or the check is decoration.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contractDrift } from './contract';

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

	it.each<[string, (schemas: Json) => void]>([
		[
			'a response field removed',
			(s) => {
				const accepted = variant(s.EvaluateResponse, 'outcome', 'accepted');
				delete accepted.properties.finalState;
				accepted.required = accepted.required.filter((k: string) => k !== 'finalState');
			},
		],
		[
			'a response field renamed',
			(s) => {
				s.StatusResponse.properties.uptime = s.StatusResponse.properties.uptimeMs;
				delete s.StatusResponse.properties.uptimeMs;
				s.StatusResponse.required = s.StatusResponse.required.map((k: string) => (k === 'uptimeMs' ? 'uptime' : k));
			},
		],
		[
			'an enum value renamed',
			(s) => (s.OrderState.enum = s.OrderState.enum.map((x: string) => (x === 'partially_paid' ? 'part_paid' : x))),
		],
		[
			'a required request field added',
			(s) => {
				s.EvaluateRequest.properties.currency = { type: 'string' };
				s.EvaluateRequest.required.push('currency');
			},
		],
		['a request bound tightened', (s) => (s.EvaluateRequest.properties.events.maxItems = 32)],
		[
			'an event variant removed',
			(s) => (s.EventInput.oneOf = s.EventInput.oneOf.filter((v: Json) => v.properties.type.enum[0] !== 'refund')),
		],
		['a request reopened to unknown fields', (s) => delete s.EvaluateRequest.additionalProperties],
		['an error code added', (s) => s.ErrorCode.enum.push('rate_limited')],
		['a component removed', (s) => delete s.LiveResponse],
	])('detect %s', (_, change) => {
		expect(contractDrift(mutated(change)).length).toBeGreaterThan(0);
	});
});
