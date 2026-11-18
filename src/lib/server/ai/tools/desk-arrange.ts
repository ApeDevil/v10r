/**
 * Desk arrange tools — the deskbot's client actions as the model is offered them.
 *
 * These are the only desk tools WITHOUT an `execute`. The AI SDK streams a call to a tool
 * that has none to the client and ends the step there; the browser that sent the turn runs
 * the registered handler (`components/desk/arrange-action-handlers.ts`) and its
 * `ClientActionResult` comes back as this call's output on the next request, where
 * `client-action-results.ts` reads it through the contract before the model does.
 *
 * Only an action the client advertised is mounted: a tool the browser cannot run right now
 * is not offered, so the model cannot ask for it. Input schemas come from the shared
 * declarations in `#lib/desk/arrange-actions.ts` — the browser validates against the same.
 */
import { type Tool, tool } from 'ai';
import { DESK_ARRANGE_ACTIONS, type DeskArrangeActionName } from '#lib/desk/arrange-actions.ts';
import { toolInputSchema } from './desk-mutation-inputs';

const RESULT_NOTE =
	'The result reports what the browser observed afterwards: status "completed" means it happened; ' +
	'any other status means it did not — say so and use its code and message.';

const DESCRIPTIONS: Record<DeskArrangeActionName, string> = {
	desk_open_file: `Open one of the user's desk files (spreadsheet, document or record) in a workspace panel and bring it to the front. A file that is already open is brought forward, not opened twice. ${RESULT_NOTE}`,
	desk_focus_panel: `Bring an open workspace panel to the front. Use a panel id from desk_get_open_panels. ${RESULT_NOTE}`,
	desk_close_panel: `Close an open workspace panel. Use a panel id from desk_get_open_panels. A panel with unsaved work is never closed for the user. ${RESULT_NOTE}`,
};

/** The arrange tools the client advertised a mounted handler for, in declaration order. */
export function createArrangeTools(advertised: readonly string[]): Record<string, Tool> {
	const tools: Record<string, Tool> = {};
	for (const action of DESK_ARRANGE_ACTIONS) {
		if (!advertised.includes(action.name)) continue;
		tools[action.name] = tool({
			description: DESCRIPTIONS[action.name],
			inputSchema: toolInputSchema(action.input),
		});
	}
	return tools;
}
