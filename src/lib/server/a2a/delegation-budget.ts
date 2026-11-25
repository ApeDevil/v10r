/**
 * How many delegations one turn and one conversation may propose, and how deep a delegation
 * chain may go. Checked when the model proposes a delegation — before a card is fetched or a
 * human is asked — so a model looping on the tool spends nothing and bothers no one.
 *
 * Depth: a human turn is depth 0 and may delegate (depth 1). A turn that runs on behalf of a
 * delegated task would be depth 1 and may not: nothing reaches past one hop through v10r.
 * Today no such turn exists — v10r's own A2A skills run deterministic checks, no assistant —
 * so the depth rule is the guard for the day one does.
 */
import { A2A_DELEGATION_LIMITS } from './config.ts';

export type DelegationBudgetRefusal = 'turn_budget' | 'conversation_budget' | 'depth';

export interface DelegationBudget {
	/** Spend one proposal; the refusal says which bound stopped it. */
	take(): { ok: true } | { ok: false; refusal: DelegationBudgetRefusal };
	readonly proposedThisTurn: number;
}

export interface DelegationBudgetInput {
	/** The turn's delegation depth: 0 for a human turn. */
	depth: number;
	/** Delegations already proposed earlier in this conversation (read from its proposals). */
	proposedInConversation: number;
	limits?: { perTurn: number; perConversation: number; maxDepth: number };
}

export function createDelegationBudget(input: DelegationBudgetInput): DelegationBudget {
	const limits = input.limits ?? A2A_DELEGATION_LIMITS;
	let proposed = 0;
	return {
		take() {
			if (input.depth + 1 > limits.maxDepth) return { ok: false, refusal: 'depth' };
			if (proposed >= limits.perTurn) return { ok: false, refusal: 'turn_budget' };
			if (input.proposedInConversation + proposed >= limits.perConversation) {
				return { ok: false, refusal: 'conversation_budget' };
			}
			proposed++;
			return { ok: true };
		},
		get proposedThisTurn() {
			return proposed;
		},
	};
}
