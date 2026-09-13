/**
 * desk-plan — proposals and approval: the deskbot never changes an existing file in the
 * loop. A gated tool returns a `requiresApproval` sentinel and `desk_propose_plan` batches a
 * whole sequence; either becomes a pending proposal the user decides on, and the turn ends
 * there (the approval boundary). Granted implicitly by any mutating scope.
 *
 * The `<planning>` guide is injected only when `shouldRequirePlan` fires — a mutating scope
 * and destructive phrasing — because the common-case one-shot interaction must NOT plan
 * first. This is soft guidance: the *hard* gate lives at the tool layer, where every
 * write/overwrite/delete returns the sentinel instead of mutating, so the mutation can only
 * happen via the server-verified proposal approve-route replay
 * (`policy/governor.ts` → `requiresApproval`).
 */
import type { AssistantCapability } from '../profile/profile';
import type { DeskToolScope } from '../tools/_types';
import { createProposePlanTool } from '../tools/propose-plan';

/** Read-only desk scopes — neither gates the plan loop nor counts toward the mutation step budget. */
const READONLY_SCOPES: ReadonlySet<DeskToolScope> = new Set(['desk:read', 'desk:ask']);

/** True when any granted scope can mutate desk state (write/create/delete). */
export function hasMutatingScope(scopes: readonly DeskToolScope[]): boolean {
	return scopes.some((s) => !READONLY_SCOPES.has(s));
}

/** Input for the plan-gating predicate. */
export interface PlanPredicateInput {
	/** The turn can mutate desk state — a write/create/delete scope is granted. */
	mutatingScopeGranted: boolean;
	/** The user's phrasing signals a destructive / overwrite / bulk operation. */
	destructiveIntent: boolean;
}

/** Destructive-intent phrasing heuristic — the second input to `shouldRequirePlan`. */
export function hasDestructiveIntent(text: string): boolean {
	return /\b(delete|remove|clear|wipe|purge|erase|drop|reset|overwrite|replace|bulk|all|every|each|multiple)\b/i.test(
		text,
	);
}

/**
 * Decide whether a turn should be *instructed* to plan first (inject the `<planning>` guide
 * so the model batches its work into one `desk_propose_plan`). WIDENED from the old
 * three-condition AND (≥2 tools + ≥2 targets), which let every single-target destructive
 * op — overwrite one doc, clear one sheet, delete one file — skip planning entirely.
 */
export function shouldRequirePlan(input: PlanPredicateInput): boolean {
	return input.mutatingScopeGranted && input.destructiveIntent;
}

export const PLANNING_GUIDE = `<planning>
Before a step that writes, overwrites, or deletes desk items — even a single one —
call desk_propose_plan first with the full sequence you intend to execute. Write,
overwrite, and delete actions are queued for the user to approve and do NOT take
effect when you call their tools, so batch related changes into ONE plan rather
than emitting many separate approval cards.
Each step's "args" must hold the exact arguments that step's tool will run with
(e.g. { "file_id": "<real id>" }) — resolve real ids first via desk_list_files or
the open panels, never invent ids or leave args empty, or the approved plan will fail.

Do NOT call desk_propose_plan for:
- Single-tool read operations (desk_list_files, desk_read_file, desk_file_tree, desk_search_files, desk_get_open_panels)
- Creating brand-new files (desk_create_markdown, desk_create_spreadsheet) — creates are reversible and take effect immediately
- Answering questions from retrieved context or desk-context alone
- Acknowledgements or clarifications

If the user has already approved a plan in this conversation and you are executing a step from it, proceed directly — do not re-plan.
</planning>`;

export const deskPlan: AssistantCapability = {
	id: 'desk-plan',
	when: 'a mutating scope (write, create or delete) is granted',
	guidance: `Actions that change an existing file — updating cells, editing or overwriting a document, renaming, or deleting — do NOT take effect when you call the tool. They are queued for the user to approve first, and your turn ends there: the approval card says what is proposed, so do not narrate it, and never claim the change is already done. Once the user has decided, the conversation carries a receipt of what ran.
If you have more planned steps from an approved plan, continue executing them before emitting your final response.`,
	activates: (turn) => {
		if (!hasMutatingScope(turn.scopes)) return { active: false, reason: 'scope_off' };
		if (!turn.hasTools) return { active: false, reason: turn.toolsCooled ? 'providers_cooled' : 'no_tools' };
		return { active: true };
	},
	tools: (turn) => createProposePlanTool(turn.userId),
	guide: (turn, state) =>
		state.activations.get('desk-plan')?.active &&
		shouldRequirePlan({ mutatingScopeGranted: true, destructiveIntent: hasDestructiveIntent(turn.userMsgText) })
			? { id: 'planning', section: 'guide', text: PLANNING_GUIDE, stable: true }
			: null,
};
