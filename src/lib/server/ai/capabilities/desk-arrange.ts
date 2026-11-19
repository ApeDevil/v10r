/**
 * desk-arrange — the workspace itself: open a file in a panel, bring a panel to the front,
 * close a panel. Granted by `desk:arrange`.
 *
 * The one desk capability whose tools the SERVER cannot run: they are client actions
 * (`executor: 'client'`), executed by the browser that sent the turn. So the activation
 * rule has a clause no other capability needs — the client must have advertised a mounted
 * handler (`turn.clientActions`). No Desk on screen, no offer; and a turn that already
 * spent its client actions stops being offered them, which is what ends the round trips.
 */
import { DESK_ARRANGE_MAX_ACTIONS_PER_TURN } from '#lib/desk/arrange-actions.ts';
import type { AssistantCapability } from '../profile/profile';
import { createArrangeTools } from '../tools/desk-arrange';
import { deskScopeActivation } from './desk-scope';

const scopeGranted = deskScopeActivation('desk:arrange');

export const deskArrange: AssistantCapability = {
	id: 'desk-arrange',
	when: "the desk:arrange scope is granted and the user's browser advertises a mounted handler",
	scope: {
		id: 'desk:arrange',
		description: 'arrange: Open files in panels, bring a panel to the front, close a panel',
	},
	guidance: `desk_open_file, desk_focus_panel and desk_close_panel act on the user's screen, not on their files. Use them when the user asks to open, show, switch to or close something — not as a side effect of answering.
Find the file first (desk-context, desk_list_files, desk_search_files), then open it by its id.
Each returns a result from the user's browser. Only status "completed" means it happened; for any other status tell the user it did not and why. Never describe a panel as open, focused or closed without a "completed" result for it.
They change what is shown, never a file: to change a file's contents or name use the edit tools, which wait for the user's approval.`,
	activates: (turn) => {
		const scope = scopeGranted(turn);
		if (!scope.active) return scope;
		if (!turn.clientActions?.length) return { active: false, reason: 'no_client_handler' };
		if ((turn.clientActionsSpent ?? 0) >= DESK_ARRANGE_MAX_ACTIONS_PER_TURN) {
			return { active: false, reason: 'action_budget' };
		}
		return { active: true };
	},
	tools: (turn) => createArrangeTools(turn.clientActions ?? []),
};
