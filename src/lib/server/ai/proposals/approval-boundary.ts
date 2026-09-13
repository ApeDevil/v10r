/**
 * The approval boundary — where a deskbot turn stops so a human can decide.
 *
 * A gated desk tool never mutates in the loop; it returns a `requiresApproval` sentinel.
 * `desk_propose_plan` returns one for a whole validated sequence. This module is the one
 * reader of both shapes: it turns a step's tool results into the `ProposedToolCall[]`
 * the proposal persists and the `ProposalCardStep[]` the PlanCard shows, and it is the
 * `stopWhen` condition that ends the loop right after such a step — so a turn has exactly
 * one proposal, no "awaiting approval" prose behind it, and no hidden pending work.
 */
import type { StopCondition, ToolSet } from 'ai';
import type { ProposedTarget, ProposedToolCall } from '$lib/server/db/schema/ai/proposal';
import { type RetentionRuleId, retentionDays } from '$lib/server/retention';
import type { ProposalCardStep, ProposalStepRecovery } from '$lib/types/ai-proposal';
import { TOOL_MANIFEST, type ToolRisk } from '$lib/types/ai-tools';
import { type DeskExecutableTool, TOOL_RECOVERY } from '../tools/desk-execute';

/** One approval the model asked for — a step of the proposal to be. */
export type ApprovalRequest = ProposedToolCall;

/** What a gated single tool returns instead of mutating. */
export interface GatedToolSentinel {
	requiresApproval: true;
	action: string;
	target?: ProposedTarget;
}

/** What `desk_propose_plan` returns once the plan validated. */
export interface PlanSentinel {
	requiresApproval: true;
	goal: string;
	steps: ApprovalRequest[];
}

export function isApprovalSentinel(output: unknown): output is GatedToolSentinel | PlanSentinel {
	return (
		typeof output === 'object' &&
		output !== null &&
		(output as { requiresApproval?: unknown }).requiresApproval === true
	);
}

interface ToolResultLike {
	toolName: string;
	input?: unknown;
	output?: unknown;
}

/**
 * The approvals one step asked for. An explicit plan carries its own steps; a gated
 * single tool contributes itself with the args the model CALLED it with (`input`, which
 * — unlike the output — is never compaction-wrapped). Several parallel gated calls in one
 * step become one multi-step proposal: one card, one decision.
 */
export function collectApprovalRequests(toolResults: readonly ToolResultLike[]): {
	goal: string | null;
	steps: ApprovalRequest[];
} {
	const steps: ApprovalRequest[] = [];
	let goal: string | null = null;
	for (const tr of toolResults) {
		if (!isApprovalSentinel(tr.output)) continue;
		if ('steps' in tr.output) {
			steps.push(...tr.output.steps);
			goal = tr.output.goal;
			continue;
		}
		steps.push({
			toolName: tr.toolName,
			args: (tr.input ?? {}) as Record<string, unknown>,
			rationale: tr.output.action,
			action: tr.output.action,
			target: tr.output.target,
		});
	}
	return { goal, steps };
}

const riskOf = (toolName: string): ToolRisk => TOOL_MANIFEST.find((d) => d.name === toolName)?.risk ?? 'write';

/**
 * The retention rule each recovery leans on: the card names the window the schedule
 * enforces, so the number on the card and the job that deletes on it share one owner.
 */
const RECOVERY_RETENTION: Record<ProposalStepRecovery, RetentionRuleId | null> = {
	revision: 'desk-revisions',
	soft_delete: 'desk-trash',
	rename_back: null,
	none: null,
};

/** The card's view of the steps — risk and recovery from the tool, never from the model. */
export function toCardSteps(steps: readonly ApprovalRequest[]): ProposalCardStep[] {
	return steps.map((s) => {
		const recovery = TOOL_RECOVERY[s.toolName as DeskExecutableTool] ?? 'none';
		const rule = RECOVERY_RETENTION[recovery];
		return {
			action: s.action,
			tool: s.toolName,
			risk: riskOf(s.toolName),
			rationale: s.rationale ?? '',
			recovery,
			retentionDays: rule === null ? null : retentionDays(rule),
			...(s.target
				? {
						target: {
							fileId: s.target.fileId,
							fileType: s.target.fileType,
							name: s.target.name,
							version: s.target.version,
						},
					}
				: {}),
		};
	});
}

export const riskTierOf = (steps: readonly ApprovalRequest[]): 'medium' | 'high' =>
	steps.some((s) => riskOf(s.toolName) === 'destructive') ? 'high' : 'medium';

/** The step that produced an approval request is the turn's last: stop the loop there. */
export const stoppedAtApproval: StopCondition<ToolSet> = ({ steps }) => {
	const last = steps.at(-1);
	return !!last?.toolResults.some((tr) => isApprovalSentinel(tr.output));
};
