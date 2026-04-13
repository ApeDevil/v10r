/**
 * Shared types for harness-aware chat UI components.
 *
 * Imported by `PlanCard.svelte`, `ChatPanel.svelte`, and any other
 * component that needs to read the `message.metadata.harness.*` shape.
 */

export interface ProposedStep {
	action: string;
	tool: string;
	risk: 'read' | 'create' | 'write' | 'destructive';
	rationale: string;
}

export interface ProposalMetadata {
	id: string;
	goal: string;
	steps: ProposedStep[];
	estimatedWrites: number;
	rollback: string;
	riskTier: 'low' | 'medium' | 'high';
	status: 'pending' | 'approved' | 'executed' | 'rejected' | 'failed' | 'expired';
}

/** The full shape of `message.metadata.harness` that the orchestrator emits. */
export interface HarnessMetadata {
	proposal?: ProposalMetadata;
}
