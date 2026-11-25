/**
 * `delegate_architecture_review` — the assistant asks an operator-configured A2A peer to review
 * an architecture model. External reach, so it is a HARD GATE like the desk write tools: the
 * `execute` here never sends the task. In order it
 *
 *  1. spends the delegation budget (one per turn, a few per conversation, depth one) — a model
 *     looping on the tool stops here, before any network or any human is involved;
 *  2. prepares the operation through the external-operations domain (`prepareExternalOperation`):
 *     the content screen over what the turn read, then the A2A adapter's `prepare` — the peer
 *     must be on the operator's list, the skill allowed and offered by the peer's card, the
 *     model valid; the card is read, no task sent;
 *  3. stashes the prepared operation on the turn by tool call id and answers the approval
 *     sentinel. The orchestrator persists the proposal and its `agent_external_operation` row
 *     together, exactly as for an MCP peer tool, and the card shows the disclosure.
 *
 * The delegation itself runs only after approval, through the external-operations domain's
 * execution claim calling the adapter's `verify` and `execute` once. Its result is a remote
 * claim (`verified: false`), wrapped as untrusted content.
 */
import { jsonSchema, tool } from 'ai';
import { createDelegationBudget, type DelegationBudget } from '#lib/server/a2a/index.ts';
import {
	type ExternalOperationAdapter,
	type ExternalOperationRequest,
	type PreparedExternalOperation,
	prepareExternalOperation,
} from '#lib/server/external-operations/index.ts';
import { readContentOf } from '../capabilities/external-tools';
import type { GatedToolSentinel } from '../proposals/approval-boundary';
import { cancelledBefore } from './cancelled';

/** A peer as the model may name it: id, label and the skills the operator allows. */
export interface DelegationPeerChoice {
	id: string;
	label: string;
	skills: readonly string[];
}

/**
 * What a turn that may delegate carries — built by the orchestrator for a signed-in deskbot
 * turn when the operator lists peers (`a2a/delegation-directory.ts`).
 */
export interface DelegationTurnContext {
	adapter: ExternalOperationAdapter;
	peers: readonly DelegationPeerChoice[];
	budget: DelegationBudget;
	conversationId: string | null;
}

interface DelegateReviewInput {
	peer_id: string;
	skill: string;
	model: unknown;
}

export const DELEGATE_REVIEW_TOOL = 'delegate_architecture_review';

/**
 * The context of a deployment with no delegation wired: no peers, and every proposal refused.
 * What the profile manifest renders the tool against; a live turn without a context never
 * mounts the tool at all (the capability is inactive).
 */
export function unconfiguredDelegation(): DelegationTurnContext {
	return {
		adapter: {
			protocol: 'a2a',
			prepare: async () => ({ ok: false, reason: 'no_peers' }),
			verify: async () => ({ ok: false, reason: 'no_peers' }),
			execute: async () => ({ outcome: 'refused', delivery: 'not_sent', reason: 'no_peers' }),
		},
		peers: [],
		budget: createDelegationBudget({ depth: 0, proposedInConversation: 0 }),
		conversationId: null,
	};
}

/**
 * The tool for one turn. `stash` receives the prepared operation by tool call id — the turn's
 * `externalOperations` map, which the orchestrator reads when it persists the proposal.
 */
export function createDelegateReviewTool(
	userId: string,
	context: DelegationTurnContext,
	stash: Map<string, PreparedExternalOperation>,
	panelContext?: Parameters<typeof readContentOf>[1],
) {
	const peerIds = context.peers.map((peer) => peer.id);
	const roster = context.peers.map((peer) => `${peer.id} (${peer.label}: ${peer.skills.join(', ')})`).join('; ');
	return tool({
		description:
			'Ask an independent, operator-approved review agent (A2A peer) to review an architecture model. ' +
			'The whole model is sent to that organisation, so the user must approve first: this queues the ' +
			'delegation for approval and does not send anything yet. The peer’s answer, when it comes, is ' +
			`its claim — never verified by v10r. Peers: ${roster || 'none'}.`,
		inputSchema: jsonSchema<DelegateReviewInput>({
			type: 'object',
			properties: {
				peer_id: { type: 'string', enum: peerIds, description: 'The operator id of the peer.' },
				skill: { type: 'string', description: 'The peer skill to ask for, one the peer list names.' },
				model: {
					type: 'object',
					description: 'The architecture model (format 1) exactly as Architecture Studio exports it.',
				},
			},
			required: ['peer_id', 'skill', 'model'],
			additionalProperties: false,
		}),
		execute: async ({ peer_id, skill, model }, { abortSignal, toolCallId, messages }) => {
			const gone = cancelledBefore(abortSignal);
			if (gone) return gone;
			const spent = context.budget.take();
			if (!spent.ok) {
				return { error: `Not proposed: the delegation budget is spent (${spent.refusal}).`, refusal: spent.refusal };
			}
			const request: ExternalOperationRequest = {
				protocol: 'a2a',
				peerId: peer_id,
				operation: skill,
				arguments: { model },
				userId,
				conversationId: context.conversationId,
				readContent: readContentOf(messages, panelContext),
			};
			const prepared = await prepareExternalOperation(context.adapter, request, { toolName: DELEGATE_REVIEW_TOOL });
			if (!prepared.ok)
				return { error: `Not proposed: ${prepared.reason}. Nothing was sent.`, refusal: prepared.reason };
			stash.set(toolCallId, prepared.prepared);
			const { disclosure } = prepared.prepared;
			const sentinel: GatedToolSentinel = {
				requiresApproval: true,
				action: `Send the architecture model to ${disclosure.peerLabel} (${disclosure.destination}) for "${disclosure.operation}"`,
			};
			return sentinel;
		},
	});
}
