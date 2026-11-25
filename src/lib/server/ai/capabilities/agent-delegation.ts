/**
 * agent-delegation — the assistant may hand an architecture review to an independent,
 * operator-configured A2A peer (a performance or security specialist another team runs).
 *
 * Active only on a signed-in deskbot turn that carries a `DelegationTurnContext` — the
 * orchestrator builds one (`delegationTurnContext`) when the operator lists peers in
 * `A2A_DELEGATION_PEERS`. The call is proposed through the external-operations domain, like an
 * MCP peer tool: one proposal, one `agent_external_operation` row, the approve door's claim.
 *
 * The guidance keeps the claim boundary in the model's words too: a peer's findings are its
 * assertion, reported as such, never merged into v10r's own checks.
 */
import { createDelegationBudget, loadDelegationPeers } from '#lib/server/a2a/index.ts';
import { countConversationExternalOperations } from '#lib/server/db/ai/external-operations.ts';
import type { AssistantCapability } from '../profile/profile';
import { delegationOperationAdapter } from '../proposals/external-approval';
import { createDelegateReviewTool, type DelegationTurnContext, unconfiguredDelegation } from '../tools/delegate-review';

/**
 * The delegation context for a signed-in turn of a persisted conversation, or undefined when
 * the operator lists no peer. The conversation's budget starts from the delegations its
 * proposals already hold — read from the database, not from the history the client sent.
 */
export async function delegationTurnContext(conversationId: string): Promise<DelegationTurnContext | undefined> {
	const adapter = delegationOperationAdapter();
	if (!adapter) return undefined;
	const peers = loadDelegationPeers().map((peer) => ({ id: peer.id, label: peer.label, skills: [...peer.skills] }));
	const proposedInConversation = await countConversationExternalOperations(conversationId, 'a2a');
	return {
		adapter,
		peers,
		budget: createDelegationBudget({ depth: 0, proposedInConversation }),
		conversationId,
	};
}

const WHEN_TO_USE = [
	'Call `delegate_architecture_review` only when the user asks for a second opinion on an architecture model from an independent specialist, or explicitly asks to send the model to one of the listed peers. Never on your own initiative, and never for a question you can answer from the project docs.',
	'The call does not send anything: it queues the delegation for the user to approve, and the approval card shows exactly what goes to whom. Say so in one sentence.',
	"When a peer's answer comes back, present it as that peer's claim (\"the reviewer reports…\"). Never call its findings verified, and never mix them into v10r's own check results.",
].join(' ');

export const agentDelegation: AssistantCapability = {
	id: 'agent-delegation',
	when: 'the turn carries operator-configured A2A peers and an approval door',
	guidance: WHEN_TO_USE,
	activates: (turn) => {
		if (!turn.hasTools) return { active: false, reason: turn.toolsCooled ? 'providers_cooled' : 'no_tools' };
		if (!turn.delegation || turn.delegation.peers.length === 0) return { active: false, reason: 'no_peers' };
		return { active: true };
	},
	tools: (turn, state) => ({
		delegate_architecture_review: createDelegateReviewTool(
			turn.userId,
			turn.delegation ?? unconfiguredDelegation(),
			state.externalOperations,
			turn,
		),
	}),
};
