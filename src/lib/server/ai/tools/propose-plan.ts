/**
 * `desk_propose_plan` — plan-before-execute primitive.
 *
 * For multi-step destructive batches, the model calls this tool with the full sequence
 * it intends to execute. The plan is validated against the one door it will later go
 * through (`validateProposedPlan`): known tools, parseable args, owned targets of the
 * right kind — and each step's reviewed baseline is captured then and there. A valid plan
 * comes back as a `requiresApproval` sentinel; the orchestrator persists an
 * `agent_proposal`, streams the PlanCard metadata and stops the loop at that step.
 * An invalid plan comes back as an error the model can fix within its step budget.
 *
 * On approval, `POST /api/ai/proposals/:id/approve` replays the persisted steps through
 * `executeDeskToolCall` and persists a deterministic receipt message; no model turn follows.
 *
 * This is the model's way to batch a MULTI-step destructive/overwrite plan into a single
 * approval card. It is not the only path to approval: a SINGLE write/overwrite/delete tool
 * call is hard-gated too — those tools return a `requiresApproval` sentinel instead of
 * mutating, and the orchestrator turns that into an equivalent single-step proposal.
 *
 * See `policy/governor.ts` → `shouldRequirePlan` (planning-prompt gate) and
 * `requiresApproval` (per-tool hard gate) for the predicates.
 */
import { tool } from 'ai';
import * as v from 'valibot';
import { MAX_PLAN_STEPS, validateProposedPlan } from '../proposals/plan-validation';
import { toolInputSchema } from './desk-mutation-inputs';

// Tool metadata (name → risk/scope) lives in the declarative `TOOL_MANIFEST` in `tools/index.ts`.

const ProposedPlan = v.object({
	goal: v.pipe(
		v.string(),
		v.minLength(1),
		v.description('One-sentence description of what the overall plan accomplishes.'),
	),
	steps: v.pipe(
		v.array(
			v.object({
				action: v.pipe(
					v.string(),
					v.minLength(1),
					v.description('Human-readable description of this step, e.g. "Delete scratch notes from Q2".'),
				),
				tool: v.pipe(
					v.string(),
					v.description(
						'The exact desk mutation tool that will run this step: desk_update_cells, desk_update_markdown, ' +
							'desk_rename_file, desk_delete_file, desk_create_spreadsheet or desk_create_markdown. Reads are not steps.',
					),
				),
				rationale: v.pipe(v.string(), v.description('Why this step is necessary for the goal.')),
				args: v.pipe(
					v.record(v.string(), v.unknown()),
					v.description(
						'The exact arguments object the tool will be called with, e.g. { "file_id": "fil_abc" } for ' +
							'desk_delete_file, or { "file_id": "fil_abc", "name": "Q3 notes" } for desk_rename_file. Use REAL ' +
							'ids resolved from desk_list_files or the open panels — never invent ids or leave this empty.',
					),
				),
			}),
		),
		v.minLength(1),
		v.maxLength(MAX_PLAN_STEPS),
	),
});

export function createProposePlanTool(userId: string) {
	return {
		desk_propose_plan: tool({
			description:
				'Propose a multi-step plan of desk mutations for user approval before executing anything. ' +
				'Call this BEFORE running a sequence of write or delete actions that affect more than one desk item. ' +
				'Do NOT call this for reads, for a single action (call that tool directly — it asks for approval itself), ' +
				'or after a plan has already been proposed in this conversation turn. Nothing runs until the user approves.',
			inputSchema: toolInputSchema(ProposedPlan),
			execute: async (input) => {
				const validation = await validateProposedPlan(input, userId);
				if (!validation.ok) return { error: `The plan cannot run as written: ${validation.issues.join(' ')}` };
				return { requiresApproval: true as const, goal: input.goal, steps: validation.steps };
			},
		}),
	};
}
