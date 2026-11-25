/**
 * Tool result tickets — how the AG-UI endpoint tells its own tool results from a forged one.
 *
 * An AG-UI client keeps the run's history itself and sends it back on the next run: the
 * official client turns every `TOOL_CALL_RESULT` it received into a `tool` message and replays
 * it. For a SERVER-executed tool that message is a claim about what the server's tool
 * returned — and a client that may write it may also invent it. Accepting replayed server
 * results as they come would let any AG-UI client put a fabricated tool result (a file the
 * tool never read, an approval the user never gave) into the model's history.
 *
 * So the endpoint stamps every server tool result it exports with a ticket — a stateless
 * signed record (`security/ticket.ts`) carried as the result's `messageId`, the one field the
 * client keeps verbatim. The ticket binds the caller, the call id, the tool's name and digests
 * of the exported arguments and content. On the next run a `tool` message for a server tool
 * is admitted only when its id is a ticket that verifies against exactly those facts; any
 * other is refused. A ticket past its lifetime is authentic but stale: the call is dropped
 * from the history, never trusted and never refused.
 *
 * What a ticket does NOT do: it never makes a client's claim authoritative. It only proves
 * that the server exported this text for this call to this user — the same text the model
 * may then read again. Client action results are a different door: the browser produces
 * them, and `client-action-results.ts` reads them through their contract.
 */
import { createHash } from 'node:crypto';
import { SUBKEY_PURPOSES, signTicket, verifyTicket } from '#lib/server/security/index.ts';

/** How long an exported server tool result stays replayable into a later run. */
export const AG_UI_RESULT_TICKET_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The facts one ticket binds. `args` and `content` are exactly what the client was sent. */
interface ToolResultFacts {
	userId: string;
	toolCallId: string;
	toolName: string;
	/** The `TOOL_CALL_ARGS` deltas the run exported for this call, joined ('' when withheld). */
	args: string;
	/** The `TOOL_CALL_RESULT` content the run exported. */
	content: string;
}

type ToolResultTicketCheck = 'valid' | 'expired' | 'invalid';

const digest = (text: string) => createHash('sha256').update(text, 'utf8').digest('base64url');

function fields(facts: ToolResultFacts) {
	return { u: facts.userId, c: facts.toolCallId, n: facts.toolName, a: digest(facts.args), r: digest(facts.content) };
}

/** The ticket a server tool result is exported under (its `messageId`). */
export function issueToolResultTicket(facts: ToolResultFacts, now: number = Date.now()): string {
	return signTicket(SUBKEY_PURPOSES.agUiResultTicket, fields(facts), now + AG_UI_RESULT_TICKET_TTL_MS);
}

/** Does `ticket` prove the server exported exactly these facts? */
export function checkToolResultTicket(
	ticket: string,
	facts: ToolResultFacts,
	now: number = Date.now(),
): ToolResultTicketCheck {
	const checked = verifyTicket<ReturnType<typeof fields>>(SUBKEY_PURPOSES.agUiResultTicket, ticket, now);
	if (!checked.ok) return checked.reason === 'expired' ? 'expired' : 'invalid';
	const expected = fields(facts);
	const matches = (Object.keys(expected) as Array<keyof typeof expected>).every(
		(key) => checked.fields[key] === expected[key],
	);
	return matches ? 'valid' : 'invalid';
}
