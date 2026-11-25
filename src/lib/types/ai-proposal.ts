/**
 * The proposal contract both sides of the approval door speak.
 *
 * The server persists `agent_proposal` + `agent_proposal_step`; the approve and status
 * routes answer with a `ProposalOutcome`; the desk client keeps a `ProposalRun` per card.
 * Zero imports beyond the enum mirror, so the desk bundle can read it.
 */
import type { DeskEffect, ToolRisk } from './ai-tools';
import type {
	DeskFileType,
	ExternalOperationDelivery,
	ExternalOperationProtocol,
	ExternalOperationStatus,
	ProposalRevertStatus,
	ProposalStatus,
	ProposalStepKind,
} from './db-enums';

/**
 * How an approved step is undone — derived from the TOOL, never model prose, and the same word
 * the step's server-side recovery point carries (`StepRecoveryPoint.kind`), so the card's
 * promise and the undo that runs cannot drift: `revision` (restore the pre-image
 * `desk.file_revision`), `soft_delete` (bring the file back from the trash), `rename_back`
 * (restore the previous name), `created` (move the new file to the trash). `none` is the
 * fallback for a step with nothing to undo.
 */
export type ProposalStepRecovery = 'revision' | 'soft_delete' | 'rename_back' | 'created' | 'none';

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
	risk: ToolRisk;
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
	riskTier: 'low' | 'medium' | 'high';
	status: ProposalStatus;
	/** Present when the proposal approves one external operation instead of a desk plan. */
	external?: ExternalOperationCard;
}

/**
 * What the approval card shows about one external operation — the server's `ExternalDisclosure`
 * (`#lib/server/external-operations/contract.ts`) as it crosses to the client, plus the tool
 * name the model called. Everything the user authorizes is here; nothing is left implicit.
 */
export interface ExternalOperationCard {
	toolName: string;
	protocol: ExternalOperationProtocol;
	peerId: string;
	peerLabel: string;
	/** The origin the request goes to. */
	destination: string;
	/** The remote operation (MCP tool name, A2A skill id). */
	operation: string;
	/** The exact top-level fields sent, a shortened preview of their values, and the exact size. */
	fields: string[];
	preview: string;
	bytes: number;
	credential: { kind: 'none' } | { kind: 'operator_secret'; ref: string };
	mutates: boolean;
	reversibility: 'reversible' | 'compensatable' | 'irreversible' | 'unknown';
	grant: 'once';
	/** `quotes_read_content` needs its own authorization on top of the approval. */
	contentClass: 'arguments_only' | 'quotes_read_content';
	quotedFrom: string[];
	/**
	 * The complete outgoing arguments (the preview above is the compact form). `digest` is the
	 * approval binding's `argumentsDigest`: the document parses back to the exact value the
	 * approval authorizes. `envelope` lists what the protocol adds beside the arguments.
	 */
	outgoing: {
		document: string;
		digest: string;
		bytes: number;
		envelope: { field: string; value: string }[];
	};
}

/** One external operation's durable outcome — `ai.agent_external_operation` as the client sees it. */
export interface ExternalOperationReceiptView {
	status: ExternalOperationStatus;
	/** The settled outcome; null while pending or in flight. */
	outcome: 'succeeded' | 'failed' | 'unknown' | 'refused' | null;
	delivery: ExternalOperationDelivery | null;
	reason: string | null;
	/** The peer's answer as one escaped `<untrusted-content>` element — data, never instructions. */
	result: string | null;
	settledAt: string | null;
}

/** One executed step's durable outcome — `ai.agent_proposal_step` as the client sees it. */
export interface ProposalStepReceipt {
	stepIndex: number;
	toolName: string;
	kind: ProposalStepKind;
	output: Record<string, unknown> | null;
	errorMessage: string | null;
}

/** One forward step's undo — `ai.agent_proposal_revert_step` as the client sees it. */
export interface ProposalRevertReceipt {
	/** The forward step this undoes. */
	stepIndex: number;
	kind: ProposalStepKind;
	errorMessage: string | null;
}

/** The undo of a plan that ran, once someone asked for it: its status and per-step receipts. */
export interface ProposalRevert {
	status: ProposalRevertStatus;
	steps: ProposalRevertReceipt[];
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
	/** Null until an undo was claimed (`POST /api/ai/proposals/[id]/revert`). */
	revert: ProposalRevert | null;
	/** The external operation's receipt, for a proposal that approves one. */
	external?: ExternalOperationReceiptView;
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
	/**
	 * The undo, as the client tracks it: the server's revert status, or `unknown` while a lost
	 * revert response is reconciled. Null until the user asked for one.
	 */
	revert: { phase: ProposalRevertStatus | 'unknown'; steps: ProposalRevertReceipt[] } | null;
	/** The external operation's receipt once the server answered for it. */
	external?: ExternalOperationReceiptView;
}
