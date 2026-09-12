/**
 * Step-budget policy for a tool-mounted turn: the last step the budget allows runs tool-less.
 *
 * `stopWhen: stepCountIs(n)` ends the loop after n steps whatever the model did on the nth —
 * a tool call there is executed and then the turn simply stops, with no answer behind it
 * (observed live: a third `search_catalog` after the answer text). Withholding the tools on
 * that step leaves the model exactly one thing to do: answer from what it has.
 *
 * `activeTools` narrows the tool list for one step and returns no message mutation, so the
 * AI SDK #9631 caveat (`prepareStep` message edits are silently dropped — see
 * `loop/compact.ts`) does not apply here.
 */

/** Per-step override for `streamText({ prepareStep })`: no tools on the last allowed step. */
export function answerOnLastStep(maxSteps: number) {
	return ({ stepNumber }: { stepNumber: number }): { activeTools: never[] } | undefined =>
		stepNumber >= maxSteps - 1 ? { activeTools: [] } : undefined;
}
