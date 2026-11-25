/**
 * Which external operation a turn's approval step proposes — the one rule between the gated
 * peer tools and `createProposal`.
 *
 * An external operation is approved ON ITS OWN: one proposal, one operation, nothing else in it.
 * A step that asked for an external call beside another approval (a desk edit, a second
 * external call) gets no proposal at all — mixing them would make one decision authorize two
 * kinds of authority, and a partial card would silently drop a request. The model is told
 * through the proposal error, the user sees no card that could be approved by mistake.
 */
import type { PreparedExternalOperation } from '#lib/server/external-operations/index.ts';
import { isApprovalSentinel } from './approval-boundary';

export type ExternalProposalDraft =
	| { kind: 'none' }
	| { kind: 'one'; prepared: PreparedExternalOperation; toolCallId: string }
	| { kind: 'refused'; message: string };

export const EXTERNAL_PROPOSAL_ALONE =
	'An external call must be approved on its own. Nothing was proposed or sent; ask again with just that call.';

export function externalProposalOf(
	toolResults: ReadonlyArray<{ toolCallId: string; output?: unknown }>,
	prepared: ReadonlyMap<string, PreparedExternalOperation>,
): ExternalProposalDraft {
	const requests = toolResults.filter((tr) => isApprovalSentinel(tr.output));
	const external = requests.flatMap((tr) => {
		const operation = prepared.get(tr.toolCallId);
		return operation ? [{ operation, toolCallId: tr.toolCallId }] : [];
	});
	if (external.length === 0) return { kind: 'none' };
	const [only] = external;
	if (requests.length !== 1 || external.length !== 1 || !only) {
		return { kind: 'refused', message: EXTERNAL_PROPOSAL_ALONE };
	}
	return { kind: 'one', prepared: only.operation, toolCallId: only.toolCallId };
}
