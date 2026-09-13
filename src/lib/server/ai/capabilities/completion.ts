/**
 * completion — when the tool loop may stop, and what to say when it cannot run at all.
 *
 * The `<completion>` guidance mitigates AI SDK #8544 (`stopWhen` is a no-op when the model
 * emits zero tool calls) by telling the model explicitly when it may stop. When every
 * tool-capable provider is cooled, the same capability injects the honest-degrade note
 * instead: the tools the other guidance names are physically absent this turn, and
 * without the note the model narrates searches it never ran.
 */
import type { AssistantCapability } from '../profile/profile';

export const COMPLETION_GUIDANCE = `<completion>
You may stop calling tools when the user's request is fully satisfied.
</completion>`;

export const TOOL_DEGRADE_NOTE =
	'NOTE: tools are unavailable this turn due to provider limits. Do not claim to have searched or acted; answer from the provided context only and say plainly when you cannot verify something.';

export const completion: AssistantCapability = {
	id: 'completion',
	when: 'tools are mounted this turn',
	guidance: COMPLETION_GUIDANCE,
	activates: (turn) =>
		turn.hasTools ? { active: true } : { active: false, reason: turn.toolsCooled ? 'providers_cooled' : 'no_tools' },
	guide: (turn) =>
		turn.toolsCooled ? { id: 'tool-degrade', section: 'guide', text: TOOL_DEGRADE_NOTE, stable: true } : null,
};
