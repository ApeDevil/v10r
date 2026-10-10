/**
 * AGENT PROPOSAL STEP — the durable receipt of one executed plan step.
 *
 * Written INSIDE the transaction that runs the step's desk mutation, so the two
 * commit or roll back together: a mutation with no receipt, or a receipt with no
 * mutation, cannot exist. That is what lets a lost HTTP response or a repeated
 * approval be answered from the receipts instead of by re-running anything — the
 * primary key `(proposal_id, step_index)` refuses a second execution of the same step.
 *
 * `agent_proposal.status` remains the state machine; this table is its evidence.
 */
import { foreignKey, integer, jsonb, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import type { ProposalStepRecovery } from '$lib/types/ai-proposal';
import { aiSchema } from './conversation';
import { agentProposal } from './proposal';

export const proposalStepKindEnum = aiSchema.enum('agent_proposal_step_kind', ['ok', 'failed', 'conflict']);

/**
 * What undoing one `ok` step needs, captured by the step itself when it ran: the state it
 * left the file in (the undo's compare-and-swap baseline) and what to put back. Server-only
 * — never part of the model-visible `output`. `fileUpdatedAt` is ISO; the undo compares it
 * to the locked row in JS, as `lockFileIfUnchanged` does.
 */
export type StepRecoveryPoint =
	| {
			kind: Extract<ProposalStepRecovery, 'revision'>;
			fileId: string;
			fileType: 'spreadsheet' | 'markdown';
			/** The pre-image `desk.file_revision` row; null when the write changed no content. */
			revisionId: string | null;
			/** The content version the step wrote. */
			version: number;
			fileUpdatedAt: string;
	  }
	| { kind: Extract<ProposalStepRecovery, 'rename_back'>; fileId: string; previousName: string; fileUpdatedAt: string }
	| { kind: Extract<ProposalStepRecovery, 'soft_delete'>; fileId: string; fileUpdatedAt: string }
	| { kind: Extract<ProposalStepRecovery, 'created'>; fileId: string; fileUpdatedAt: string };

export const agentProposalStep = aiSchema.table(
	'agent_proposal_step',
	{
		proposalId: text('proposal_id')
			.notNull()
			.references(() => agentProposal.id, { onDelete: 'cascade' }),
		/** Position in `agent_proposal.payload`. */
		stepIndex: integer('step_index').notNull(),
		toolName: text('tool_name').notNull(),
		kind: proposalStepKindEnum('kind').notNull(),
		/** The replay's output for the step — what the receipt shows and the model later reads. */
		output: jsonb('output'),
		errorMessage: text('error_message'),
		/** The desk file a create step produced; the id a repeated approval must NOT mint again. */
		createdFileId: text('created_file_id'),
		/** What an undo of this step needs; null for steps that did not succeed. */
		recovery: jsonb('recovery').$type<StepRecoveryPoint>(),
		executedAt: timestamp('executed_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.proposalId, table.stepIndex] })],
);

/**
 * REVERT STEP — the durable receipt of undoing one forward step.
 *
 * Keyed by the forward step it undoes, with a foreign key onto that receipt: a revert can
 * only exist for a step that ran, and each step is undone at most once. Written in the same
 * transaction as the compensating desk mutation, exactly like the forward receipt.
 */
export const agentProposalRevertStep = aiSchema.table(
	'agent_proposal_revert_step',
	{
		proposalId: text('proposal_id').notNull(),
		/** The forward step this receipt undoes. */
		stepIndex: integer('step_index').notNull(),
		kind: proposalStepKindEnum('kind').notNull(),
		errorMessage: text('error_message'),
		revertedAt: timestamp('reverted_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.proposalId, table.stepIndex] }),
		foreignKey({
			name: 'agent_proposal_revert_step_forward_fk',
			columns: [table.proposalId, table.stepIndex],
			foreignColumns: [agentProposalStep.proposalId, agentProposalStep.stepIndex],
		}).onDelete('cascade'),
	],
);
