/**
 * Shared types for harness-aware chat UI components.
 *
 * Imported by `PlanCard.svelte`, `ChatPanel.svelte`, and any other
 * component that needs to read the `message.metadata.harness.*` shape.
 *
 * A rendered plan step is `ProposalCardStep` (`$lib/types/turn-trace`) — the same shape the
 * showcase fixtures build. The server's `ProposedStep` is a different type on purpose: it
 * carries the `args` the approve-route replays, which never reach the client.
 */
import type { ProposalCardStep } from '$lib/types/turn-trace';

export interface ProposalMetadata {
	id: string;
	goal: string;
	steps: ProposalCardStep[];
	estimatedWrites: number;
	rollback: string;
	riskTier: 'low' | 'medium' | 'high';
	status: 'pending' | 'approved' | 'executed' | 'rejected' | 'failed' | 'expired';
}

/** The full shape of `message.metadata.harness` that the orchestrator emits. */
export interface HarnessMetadata {
	proposal?: ProposalMetadata;
}
