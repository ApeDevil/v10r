/**
 * AG-UI `RunAgentInput` → the deskbot's own request — the AG-UI endpoint's trust boundary.
 *
 * An AG-UI client sends a whole run request: its copy of the thread (`messages`), the
 * tools it can execute (`tools`), ambient `context`, a client-owned `state`, `resume` answers
 * to interrupts, and free `forwardedProps`. None of it is a second agent's configuration:
 * it is mapped onto exactly the request `POST /api/ai/deskbot` takes and validated by the
 * same `DeskRequestSchema`, so the orchestrator runs the same turn behind both doors.
 *
 * What is admitted, and what is refused (each refusal is a 422 with its own code):
 *
 *   messages   user text and assistant text pass; a tool call passes as the tool part the
 *              AI SDK history carries. A client action's result (`executor: 'client'`) is the
 *              one tool result a client produces — it is passed on and read through the
 *              client action contract by the orchestrator (`client-action-results.ts`). A
 *              server tool's result is admitted only with the ticket the server exported it
 *              under (`tool-result-ticket.ts`); without one it is refused as forged, and an
 *              orphaned result (no call) is refused. Unanswered calls are dropped: nothing is
 *              known about them. System, developer, reasoning and activity messages are
 *              dropped — the profile composes the instructions, not the client.
 *   tools      only the surface's client actions are taken, as the client's advertisement of
 *              what it can run (`clientActions`); a tool named like a server tool is refused
 *              (a frontend may not shadow one); any other tool is ignored — the model is
 *              never offered it, and its client-supplied schema is never read.
 *   state      v10r keeps no client-owned agent state, and server-authoritative state (a
 *              proposal's status) lives in the database; a non-empty `state` could only be a
 *              claim about it, so it is refused.
 *   resume     an approval is decided through `POST /api/ai/proposals/[id]/approve`, which
 *              checks ownership and the proposal's state; a resume entry is refused.
 *   context    refused when non-empty: the desk's bounded context travels as `panelContext`.
 *   forwardedProps  only the deskbot request's own fields (`conversationId`, `providerId`,
 *              `toolScopes`, `deskLayout`, `panelContext`, `activeWorkspace`); any other key is
 *              refused, so nothing can arrive under a name the endpoint does not read.
 */
import type { Message, RunAgentInput, ToolCall } from '@ag-ui/core';
import { RunAgentInputSchema } from '@ag-ui/core/schemas';
import type { UIMessage } from 'ai';
import { type InferOutput, safeParse } from 'valibot';
import { DeskRequestSchema } from '#lib/server/ai/validation.ts';
import { TOOL_MANIFEST } from '#lib/types/ai-tools.ts';
import { checkToolResultTicket } from './tool-result-ticket';
import type { AgUiRun } from './ui-stream-to-ag-ui';

/** What the deskbot route validates — the request this endpoint maps every run onto. */
type DeskRunRequest = InferOutput<typeof DeskRequestSchema>;

interface AgUiRefusal {
	status: number;
	code: string;
	message: string;
}

type AgUiRunInputReading = { ok: true; run: AgUiRun; request: DeskRunRequest } | { ok: false; refusal: AgUiRefusal };

/** The `forwardedProps` keys the endpoint reads: the deskbot request's own fields. */
const AG_UI_FORWARDED_PROPS = [
	'conversationId',
	'providerId',
	'toolScopes',
	'deskLayout',
	'panelContext',
	'activeWorkspace',
] as const;

const refuse = (code: string, message: string, status = 422): AgUiRunInputReading => ({
	ok: false,
	refusal: { status, code, message },
});

/** The client actions a surface declares — the only tools a client may bring to it. */
function clientActionsOf(surface: 'deskbot'): ReadonlySet<string> {
	return new Set(TOOL_MANIFEST.filter((d) => d.surface === surface && d.executor === 'client').map((d) => d.name));
}

const SERVER_TOOLS: ReadonlySet<string> = new Set(
	TOOL_MANIFEST.filter((d) => d.executor === 'server').map((d) => d.name),
);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** A message's content as text, or null when it carries anything but text parts. */
function textOf(content: unknown): string | null {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return null;
	let text = '';
	for (const part of content) {
		if (!isPlainObject(part) || part.type !== 'text' || typeof part.text !== 'string') return null;
		text += part.text;
	}
	return text;
}

function parseJson(text: string): unknown {
	if (!text) return {};
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

type ToolMessage = Extract<Message, { role: 'tool' }>;
type UIPart = UIMessage['parts'][number];

class Refused extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(message);
	}
}

/** One assistant tool call as the AI SDK history part it stands for, or null to drop it. */
function toolPart(
	call: ToolCall,
	result: ToolMessage | undefined,
	ctx: { userId: string; clientActions: ReadonlySet<string> },
): UIPart | null {
	const toolName = call.function.name;
	const input = parseJson(call.function.arguments);
	const base = { type: `tool-${toolName}`, toolCallId: call.id, input };
	if (ctx.clientActions.has(toolName)) {
		// The client's own answer — read through the client action contract downstream.
		if (!result) return { ...base, state: 'input-available' } as UIPart;
		const content = textOf(result.content) ?? '';
		if (result.error !== undefined) return { ...base, state: 'output-error', errorText: result.error } as UIPart;
		return { ...base, state: 'output-available', output: parseJson(content) } as UIPart;
	}
	// Everything else is the server's: a call the client cannot answer for.
	if (!result) return null;
	const content = typeof result.content === 'string' ? result.content : null;
	if (content === null)
		throw new Refused('tool_result_refused', 'A server tool result must be the text the server sent.');
	const check = checkToolResultTicket(result.id, {
		userId: ctx.userId,
		toolCallId: call.id,
		toolName,
		args: call.function.arguments,
		content,
	});
	if (check === 'expired') return null;
	if (check === 'invalid') {
		throw new Refused(
			'tool_result_refused',
			`The result for ${SERVER_TOOLS.has(toolName) ? 'server tool' : 'tool'} "${toolName}" was not issued by this server.`,
		);
	}
	return { ...base, state: 'output-available', output: content } as UIPart;
}

/** The AG-UI thread as the AI SDK history the orchestrator reads. */
function toHistory(
	messages: readonly Message[],
	ctx: { userId: string; clientActions: ReadonlySet<string> },
): UIMessage[] {
	const results = new Map<string, ToolMessage>();
	for (const message of messages) {
		if (message.role !== 'tool') continue;
		if (results.has(message.toolCallId)) throw new Refused('tool_result_refused', 'A tool call has two results.');
		results.set(message.toolCallId, message);
	}
	const answered = new Set<string>();
	const history: UIMessage[] = [];
	// Consecutive assistant messages are one assistant turn — the AG-UI client splits one
	// v10r message into a text message and a tool-call message; the history carries one.
	let turn: UIMessage | null = null;
	for (const message of messages) {
		if (message.role === 'user') {
			turn = null;
			const text = textOf(message.content);
			if (text === null) throw new Refused('unsupported_content', 'Only text user content is accepted.');
			history.push({ id: message.id, role: 'user', parts: [{ type: 'text', text }] });
			continue;
		}
		if (message.role !== 'assistant') continue;
		if (!turn) {
			turn = { id: message.id, role: 'assistant', parts: [] };
			history.push(turn);
		}
		// The continued message is the one the client's tool calls hang off.
		if (message.toolCalls?.length) turn.id = message.id;
		turn.parts.push({ type: 'step-start' });
		if (message.content) turn.parts.push({ type: 'text', text: message.content });
		for (const call of message.toolCalls ?? []) {
			answered.add(call.id);
			const part = toolPart(call, results.get(call.id), ctx);
			if (part) turn.parts.push(part);
		}
	}
	for (const toolCallId of results.keys()) {
		if (!answered.has(toolCallId)) throw new Refused('tool_result_refused', 'A tool result answers no tool call.');
	}
	return history.filter((m) => m.role === 'user' || m.parts.some((p) => p.type !== 'step-start'));
}

/** Read one AG-UI run request for the deskbot surface. */
export function readAgUiRunInput(body: unknown, ctx: { userId: string; surface: 'deskbot' }): AgUiRunInputReading {
	const parsed = RunAgentInputSchema.safeParse(body);
	if (!parsed.success) return refuse('invalid_run_input', 'The body is not an AG-UI RunAgentInput.', 400);
	const input: RunAgentInput = parsed.data as RunAgentInput;

	if (input.state !== undefined && !(isPlainObject(input.state) && Object.keys(input.state).length === 0)) {
		return refuse('state_refused', 'This agent keeps no client-owned state; send an empty state.');
	}
	if (input.resume?.length) {
		return refuse('resume_refused', 'Decisions are reported through POST /api/ai/proposals/[id]/approve.');
	}
	if (input.context?.length) {
		return refuse('context_refused', 'Run context is not accepted; send desk context as forwardedProps.panelContext.');
	}
	const forwarded = input.forwardedProps ?? {};
	if (!isPlainObject(forwarded)) return refuse('forwarded_props_refused', 'forwardedProps must be an object.');
	const unknownKey = Object.keys(forwarded).find((key) => !(AG_UI_FORWARDED_PROPS as readonly string[]).includes(key));
	if (unknownKey) return refuse('forwarded_props_refused', `forwardedProps.${unknownKey} is not read by this agent.`);

	const declared = clientActionsOf(ctx.surface);
	const clientActions: string[] = [];
	for (const tool of input.tools ?? []) {
		if (SERVER_TOOLS.has(tool.name)) {
			return refuse('tool_refused', `"${tool.name}" is a server tool; a client may not declare it.`);
		}
		if (declared.has(tool.name) && !clientActions.includes(tool.name)) clientActions.push(tool.name);
	}

	let messages: UIMessage[];
	try {
		messages = toHistory(input.messages, { userId: ctx.userId, clientActions: declared });
	} catch (err) {
		if (err instanceof Refused) return refuse(err.code, err.message);
		throw err;
	}

	const request = safeParse(DeskRequestSchema, {
		...forwarded,
		messages,
		...(clientActions.length ? { clientActions } : {}),
	});
	if (!request.success) {
		const issue = request.issues[0];
		const path = issue.path?.map((p) => p.key).join('.') ?? 'body';
		return refuse('validation_failed', `${path}: ${issue.message}`, 400);
	}
	return { ok: true, run: { threadId: input.threadId, runId: input.runId }, request: request.output };
}
