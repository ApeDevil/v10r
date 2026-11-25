/**
 * Projected peer tools as AI SDK v6 `tool()` objects — the shape `composeTurn` mounts.
 *
 * Not wired into any surface yet: a live turn needs an admin peer-config screen (URL, secret
 * reference, allow and read-only lists, fingerprint approval) and an approval card that can show
 * an external call. Until then this is the contract those pieces plug into.
 *
 * Only a `read` tool calls the peer from the loop, and even it passes the disclosure check
 * (`callPeerTool` → `preparePeerArguments`). A `write` or `destructive` tool mirrors the desk
 * write tools' hard gate (`tools/desk-write.ts`): its `execute` never contacts the peer. It
 * checks the arguments against the disclosure policy — a call that could never be sent is
 * answered with a refusal instead of being put in front of a human — and otherwise answers the
 * approval sentinel the orchestrator turns into a pending proposal —
 *
 *     { requiresApproval: true, action: string }          // GatedToolSentinel, proposals/approval-boundary.ts
 *
 * — so the call can only run through the proposal/approval door: the wiring builds a
 * `PeerCallApproval` (`createPeerCallApproval`, whose `disclosure` the card shows) and, once a
 * human approved it, runs `executeApprovedPeerCall`. (A tool with NO `execute` would be worse
 * here: AI SDK streams such a call to the browser, the client-action door, where
 * `client-actions.gate.test.ts` forbids anything that changes stored data and a browser's word
 * is not an approval.)
 */
import { jsonSchema, type ToolSet, tool } from 'ai';
import { requiresApproval } from '../policy';
import type { GatedToolSentinel } from '../proposals/approval-boundary';
import { preparePeerArguments } from './disclosure';
import { callPeerTool, type PeerCallBudget, type PeerCallResult, settledPeerCall } from './peer-call';
import type { PeerConnection } from './peer-tools';
import type { PeerToolProjection, ProjectedPeerTool } from './projection';

function gatedSentinel(projected: ProjectedPeerTool): GatedToolSentinel {
	const { remoteName, peerId } = projected.descriptor;
	return { requiresApproval: true, action: `Call "${remoteName}" on the external MCP peer "${peerId}"` };
}

export function toPeerToolSet(
	connection: PeerConnection,
	projection: PeerToolProjection,
	options: { budget: PeerCallBudget },
): ToolSet {
	const set: ToolSet = {};
	for (const projected of projection.tools) {
		const { definition, descriptor } = projected;
		const inputSchema = jsonSchema<Record<string, unknown>>(definition.inputSchema as Parameters<typeof jsonSchema>[0]);
		set[definition.name] = requiresApproval(descriptor.risk)
			? tool({
					description: definition.description,
					inputSchema,
					execute: async (args): Promise<GatedToolSentinel | PeerCallResult> => {
						const prepared = preparePeerArguments(connection.peer, projected.tool, args, connection.resolveSecret);
						if (!prepared.ok) {
							return settledPeerCall(
								descriptor.name,
								'disclosure_refused',
								`Not proposed: the arguments failed the disclosure check (${prepared.reason}).`,
							);
						}
						return gatedSentinel(projected);
					},
				})
			: tool({
					description: definition.description,
					inputSchema,
					execute: (args, { abortSignal }): Promise<PeerCallResult> =>
						callPeerTool(connection, projected, args, { signal: abortSignal, budget: options.budget }),
					// Already one escaped `<untrusted-content>` element; `structured` and flags stay loop-side.
					toModelOutput: ({ output }) => ({ type: 'text', value: output.text }),
				});
	}
	return set;
}
