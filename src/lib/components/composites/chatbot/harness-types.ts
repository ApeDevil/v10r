/**
 * Shared types for harness-aware chat UI components.
 *
 * Imported by `PlanCard.svelte`, `ChatPanel.svelte`, and any other
 * component that needs to read the `message.metadata.harness.*` shape.
 *
 * A rendered plan step is `ProposalCardStep` (`$lib/types/ai-proposal`) — the same shape the
 * showcase fixtures build. The server's `ProposedToolCall` is a different type on purpose: it
 * carries the `args` the approve replay runs, which never reach the client.
 */
import type { ProposalCardData } from '$lib/types/ai-proposal';

/**
 * The card the orchestrator streams on the assistant message. `status` is always
 * `pending` on the wire — what happened afterwards is the client's `ProposalRun`
 * (`$lib/types/ai-proposal`), reconciled from the approve and status routes.
 */
export type ProposalMetadata = ProposalCardData;

/**
 * Why no card could be shown although the model asked for one: the proposal row
 * could not be written. The model's transcript already carries the tool error.
 */
export interface ProposalError {
	message: string;
}

/** The full shape of `message.metadata.harness` that the orchestrator emits. */
export interface HarnessMetadata {
	proposal?: ProposalMetadata;
	proposalError?: ProposalError;
}
