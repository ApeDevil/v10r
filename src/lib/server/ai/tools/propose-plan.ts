/**
 * `desk_propose_plan` — plan-before-execute primitive.
 *
 * For multi-step destructive batches, the model calls this tool first with
 * the full sequence it intends to execute. The orchestrator intercepts the
 * tool call, persists an `agent_proposal` row, and streams a structured
 * `harness.proposal` metadata part to the client. The stream closes and the
 * frontend renders a `PlanCard` for user approval.
 *
 * On approval, the REST endpoint `POST /api/ai/proposals/:id/approve` runs
 * the payload and the client starts a fresh chat turn with a
 * `resumeFromProposalId` sentinel so the model sees the executed results.
 *
 * This tool does NOT fire for:
 *  - single-step destructive actions (those use `desk_delete_file`'s
 *    own two-phase `confirmed: boolean` pattern)
 *  - read-only operations
 *  - questions answerable from desk-context alone
 *
 * See `policy/governor.ts` → `shouldRequirePlan` for the predicate.
 */
import { jsonSchema, tool } from 'ai';
import type { DeskToolMeta } from './_types';

/** Shape of a single proposed step inside the plan payload. */
export interface ProposedStep {
	action: string;
	tool: string;
	risk: 'read' | 'create' | 'write' | 'destructive';
	rationale: string;
}

export const proposePlanMeta: Record<string, DeskToolMeta> = {
	desk_propose_plan: { risk: 'read', scope: 'desk:read' },
};

export function createProposePlanTool() {
	return {
		desk_propose_plan: tool({
			description:
				'Propose a multi-step destructive plan for user approval before executing anything. ' +
				'Call this BEFORE running a sequence of write or delete actions that affect more than one desk item. ' +
				'Do NOT call this for single-tool reads, single-target destructive actions (use desk_delete_file directly), ' +
				'or when a plan has already been approved in this conversation turn.',
			inputSchema: jsonSchema<{
				goal: string;
				steps: ProposedStep[];
				estimated_writes: number;
				rollback: string;
			}>({
				type: 'object',
				properties: {
					goal: {
						type: 'string',
						description: 'One-sentence description of what the overall plan accomplishes.',
					},
					steps: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								action: {
									type: 'string',
									description: 'Human-readable description of this step, e.g. "Delete scratch notes from Q2".',
								},
								tool: {
									type: 'string',
									description: 'The exact tool name that will run this step, e.g. "desk_delete_file".',
								},
								risk: {
									type: 'string',
									enum: ['read', 'create', 'write', 'destructive'],
								},
								rationale: {
									type: 'string',
									description: 'Why this step is necessary for the goal.',
								},
							},
							required: ['action', 'tool', 'risk', 'rationale'],
						},
					},
					estimated_writes: {
						type: 'number',
						description: 'How many files or cells this plan will modify or delete.',
					},
					rollback: {
						type: 'string',
						description: 'One-sentence description of how to undo the plan if executed.',
					},
				},
				required: ['goal', 'steps', 'estimated_writes', 'rollback'],
			}),
			execute: async (input) => {
				// The orchestrator intercepts this tool call. When it sees
				// `desk_propose_plan` in the step results, it persists an
				// `agent_proposal` row, emits the proposal as a stream metadata
				// part, and closes the stream so the UI can render a PlanCard.
				//
				// This execute is a thin placeholder so AI SDK's loop machinery
				// doesn't complain about a missing executor. The actual work
				// happens in `loop/orchestrate.ts` via the intercept path.
				return {
					status: 'awaiting_approval',
					goal: input.goal,
					stepCount: input.steps.length,
					estimatedWrites: input.estimated_writes,
				};
			},
		}),
	};
}
