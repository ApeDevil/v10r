/**
 * The lab's preset evaluation requests. The page sends a preset id; the server owns the
 * body. That keeps the public form from becoming a free-form channel into the service.
 * Each preset states the answer the rules must give, and `verify.ts` checks every one
 * against the real service — so these comments cannot quietly go stale.
 */
import type { components } from '$lib/showcases/external-service/contract.generated';
import type { EvaluationPresetId, OrderEvaluationRequest } from '$lib/showcases/external-service/types';

type Schemas = components['schemas'];

export interface EvaluationPreset {
	request: OrderEvaluationRequest;
	expect:
		| { outcome: 'accepted'; finalState: Schemas['OrderState'] }
		| { outcome: 'refused'; index: number; reason: Schemas['RefusalReason'] };
}

export const EVALUATION_PRESETS: Record<EvaluationPresetId, EvaluationPreset> = {
	// Split payment, then fulfilment.
	fulfilled: {
		request: {
			totalCents: 4_990,
			events: [
				{ type: 'pay', amountCents: 2_000 },
				{ type: 'pay', amountCents: 2_990 },
				{ type: 'ship' },
				{ type: 'deliver' },
			],
		},
		expect: { outcome: 'accepted', finalState: 'delivered' },
	},
	// A partial refund leaves the order delivered, with 500 refunded.
	partial_refund: {
		request: {
			totalCents: 1_500,
			events: [
				{ type: 'pay', amountCents: 1_500 },
				{ type: 'ship' },
				{ type: 'deliver' },
				{ type: 'refund', amountCents: 500 },
			],
		},
		expect: { outcome: 'accepted', finalState: 'delivered' },
	},
	// Shipping needs the full total.
	ship_unpaid: {
		request: { totalCents: 1_000, events: [{ type: 'pay', amountCents: 400 }, { type: 'ship' }] },
		expect: { outcome: 'refused', index: 1, reason: 'payment_incomplete' },
	},
	// A payment above the open balance.
	overpaid: {
		request: { totalCents: 1_000, events: [{ type: 'pay', amountCents: 1_200 }] },
		expect: { outcome: 'refused', index: 0, reason: 'exceeds_balance' },
	},
};

/**
 * The `unvalidated` drill's body: out of bounds twice over (zero total, no events). The
 * client's validation would refuse it, so the drill sends it through an operation without a
 * request schema, to show the service refusing it too — validation that lived only in the
 * caller would let it through.
 */
export const UNVALIDATED_DRILL_REQUEST: OrderEvaluationRequest = { totalCents: 0, events: [] };

/** The `credential` drill's bearer: well-formed, long enough, and wrong. */
export const WRONG_CREDENTIAL = 'lab-drill-wrong-credential-0000000000000000';
