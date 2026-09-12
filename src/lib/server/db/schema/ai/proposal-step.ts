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
import { integer, jsonb, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { aiSchema } from './conversation';
import { agentProposal } from './proposal';

export const proposalStepKindEnum = aiSchema.enum('agent_proposal_step_kind', ['ok', 'failed', 'conflict']);

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
		executedAt: timestamp('executed_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.proposalId, table.stepIndex] })],
);
