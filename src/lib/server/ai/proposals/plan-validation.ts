/**
 * Validates a `desk_propose_plan` call BEFORE it becomes a PlanCard.
 *
 * The model authors a plan in prose plus tool names and args; the card the user approves
 * must describe steps that will actually run. So every step is checked against the door
 * it will later go through — known executable tool, args that parse against the tool's
 * contract, an owned target of the right kind — and the reviewed baseline is captured
 * here, at proposal time. A plan with any invalid step is refused as a whole and the
 * issues go back to the model, which has the rest of its step budget to fix them.
 */
import { DESK_EXECUTABLE_TOOLS, type DeskExecutableTool, TOOL_SCOPE } from '../tools/desk-execute';
import { describeIssues, parseMutationInput } from '../tools/desk-mutation-inputs';
import { readProposedTarget } from '../tools/proposed-target';
import type { ApprovalRequest } from './approval-boundary';

/** A plan longer than this is not one decision any more. */
export const MAX_PLAN_STEPS = 10;

export interface ProposedPlanInput {
	goal: string;
	steps: Array<{ action: string; tool: string; rationale?: string; args: Record<string, unknown> }>;
}

export type PlanValidation = { ok: true; steps: ApprovalRequest[] } | { ok: false; issues: string[] };

const TARGET_TYPE: Partial<Record<DeskExecutableTool, 'spreadsheet' | 'markdown'>> = {
	desk_update_cells: 'spreadsheet',
	desk_update_markdown: 'markdown',
};

export async function validateProposedPlan(input: ProposedPlanInput, userId: string): Promise<PlanValidation> {
	const issues: string[] = [];
	if (input.steps.length === 0) issues.push('The plan has no steps.');
	if (input.steps.length > MAX_PLAN_STEPS)
		issues.push(`The plan has ${input.steps.length} steps; the most one approval covers is ${MAX_PLAN_STEPS}.`);
	if (issues.length > 0) return { ok: false, issues };

	const steps: ApprovalRequest[] = [];
	for (const [index, step] of input.steps.entries()) {
		const label = `step ${index + 1} (${step.tool})`;
		if (!(DESK_EXECUTABLE_TOOLS as readonly string[]).includes(step.tool)) {
			issues.push(
				`${label}: not a desk mutation — a plan lists only ${DESK_EXECUTABLE_TOOLS.join(', ')}. Read first, then plan.`,
			);
			continue;
		}
		const tool = step.tool as DeskExecutableTool;
		const parsed = parseMutationInput(tool, step.args);
		if (!parsed || !parsed.success) {
			issues.push(`${label}: ${parsed ? describeIssues(parsed.issues) : 'no argument contract'}`);
			continue;
		}
		const args = parsed.output as Record<string, unknown>;

		let target: ApprovalRequest['target'];
		if (TOOL_SCOPE[tool] !== 'desk:create') {
			const fileId = args.file_id as string;
			target = (await readProposedTarget(userId, fileId)) ?? undefined;
			if (!target) {
				issues.push(`${label}: file "${fileId}" was not found — use an id from desk_list_files or the open panels.`);
				continue;
			}
			const expected = TARGET_TYPE[tool];
			if (expected && target.fileType !== expected) {
				issues.push(`${label}: "${target.name}" is a ${target.fileType}, not a ${expected}.`);
				continue;
			}
		}

		steps.push({ toolName: tool, args, rationale: step.rationale, action: step.action, target });
	}

	return issues.length > 0 ? { ok: false, issues } : { ok: true, steps };
}
