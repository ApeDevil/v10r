/**
 * The proposal contract both sides of the approval door speak.
 *
 * The server persists `agent_proposal` + `agent_proposal_step`; the approve and status
 * routes answer with a `ProposalOutcome`; the desk client keeps a `ProposalRun` per card.
 * Zero imports beyond the enum mirror, so the desk bundle can read it.
 */
import type { DeskEffect } from './ai-tools';
import type { DeskFileType, ProposalStatus, ProposalStepKind } from './db-enums';

/**
 * How an approved step can be undone — derived from the TOOL, never model prose:
 * `revision` (a pre-image `desk.file_revision` is captured before the overwrite),
 * `soft_delete` (the file waits in the trash for the retention window), `rename_back`
 * (rename it again), `none` (a create — delete it if unwanted).
 */
export type ProposalStepRecovery = 'revision' | 'soft_delete' | 'rename_back' | 'none';

/** The file a step changes, as the user reviewed it. */
export interface ProposalCardTarget {
	fileId: string;
	fileType: DeskFileType;
	name: string;
	/** The reviewed content version; null for a rename or delete (bound by `updatedAt` instead). */
	version: number | null;
}

/**
 * One proposed step as the PlanCard renders it — the canonical client-side shape, read by
 * `composites/chatbot/harness-types.ts` and the showcase fixtures. The server's
 * `ProposedToolCall` carries the `args` object the approve replay runs; it never crosses
 * to the client. `risk` and `recovery` are server-derived from the tool, never model-authored.
 */
export interface ProposalCardStep {
	action: string;
	tool: string;
	risk: 'read' | 'create' | 'write' | 'destructive';
	rationale: string;
	recovery: ProposalStepRecovery;
	/**
	 * How long the data the recovery leans on is kept — the retention schedule's window for
	 * the previous revision or the soft-deleted row; null when nothing is retained.
	 */
	retentionDays: number | null;
	/** The reviewed file, for update/rename/delete steps. */
	target?: ProposalCardTarget;
}

/**
 * PlanCard payload — what the orchestrator streams as `message.metadata.harness.proposal`
 * and what the showcase renders the REAL `PlanCard.svelte` from. `status` is always
 * `pending` on the wire; in fixtures every value is authored fiction (`demo_` ids).
 */
export interface ProposalCardData {
	id: string;
	goal: string;
	steps: ProposalCardStep[];
	estimatedWrites: number;
	riskTier: 'low' | 'medium' | 'high';
	status: ProposalStatus;
}

/** One executed step's durable outcome — `ai.agent_proposal_step` as the client sees it. */
export interface ProposalStepReceipt {
	stepIndex: number;
	toolName: string;
	kind: ProposalStepKind;
	output: Record<string, unknown> | null;
	errorMessage: string | null;
}

/**
 * The deterministic assistant message the approve door persists once a plan has run:
 * what the user reads under the card, and what the model reads as history next turn.
 */
export interface ProposalReceiptMessage {
	id: string;
	text: string;
}

/** What `POST /api/ai/proposals/[id]/approve` and `GET /api/ai/proposals/[id]` answer. */
export interface ProposalOutcome {
	id: string;
	status: ProposalStatus;
	steps: ProposalStepReceipt[];
	failureMessage: string | null;
	/** For the steps that completed — an open panel has to reload the file they changed. */
	effects: DeskEffect[];
	receiptMessage: ProposalReceiptMessage | null;
	expiresAt: string;
}

/**
 * The client-side lifecycle of one proposal — the server's status plus the two states
 * only the client can be in: `approving` (request in flight) and `unknown` (the response
 * was lost; reconcile through the status route before allowing anything else).
 */
export type ProposalRunPhase = ProposalStatus | 'approving' | 'unknown';

export interface ProposalRun {
	phase: ProposalRunPhase;
	steps: ProposalStepReceipt[];
	failureMessage: string | null;
}
