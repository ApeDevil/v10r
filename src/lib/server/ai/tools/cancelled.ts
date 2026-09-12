/**
 * The turn's signal, honoured at the tool boundary. The SDK hands every `execute` the model
 * call's `abortSignal`; drizzle takes no signal, so a query already running finishes either
 * way — but a tool that has not started yet has no reason to spend one for a client that left
 * or a step that ran out of time. Checked once, before the first read.
 */
export const CANCELLED_TOOL_RESULT = { error: 'The turn was cancelled before this tool ran.' } as const;

export function cancelledBefore(signal: AbortSignal | undefined): typeof CANCELLED_TOOL_RESULT | null {
	return signal?.aborted ? CANCELLED_TOOL_RESULT : null;
}
