/**
 * The lab's preset evaluation requests. The page sends a scenario id; the server owns the
 * body. That keeps the public form from becoming a free-form channel into the service,
 * and makes every scenario's expected answer reviewable here.
 */
import type { EvaluationScenarioId, OrderEvaluationRequest } from '$lib/showcases/external-service/types';

export const EVALUATION_SCENARIOS: Record<EvaluationScenarioId, OrderEvaluationRequest> = {
	// Accepted: split payment, then fulfilment. Ends `delivered`.
	fulfilled: {
		totalCents: 4_990,
		events: [
			{ type: 'pay', amountCents: 2_000 },
			{ type: 'pay', amountCents: 2_990 },
			{ type: 'ship' },
			{ type: 'deliver' },
		],
	},
	// Accepted: a partial refund leaves the order delivered with 500 refunded.
	partial_refund: {
		totalCents: 1_500,
		events: [
			{ type: 'pay', amountCents: 1_500 },
			{ type: 'ship' },
			{ type: 'deliver' },
			{ type: 'refund', amountCents: 500 },
		],
	},
	// Refused at event 1: `payment_incomplete` — shipping needs the full total.
	ship_unpaid: {
		totalCents: 1_000,
		events: [{ type: 'pay', amountCents: 400 }, { type: 'ship' }],
	},
	// Refused at event 0: `exceeds_balance` — a payment above the open balance.
	overpaid: {
		totalCents: 1_000,
		events: [{ type: 'pay', amountCents: 1_200 }],
	},
};

/**
 * The `unvalidated` drill's body: out of bounds twice over (zero total, no events). The
 * adapter's validation would refuse it, so the drill skips that step to show the service
 * refusing it too — validation that lived only in the caller would let it through.
 */
export const UNVALIDATED_DRILL_REQUEST: OrderEvaluationRequest = { totalCents: 0, events: [] };

/** The `credential` drill's bearer: well-formed, long enough, and wrong. */
export const WRONG_CREDENTIAL = 'lab-drill-wrong-credential-0000000000000000';
