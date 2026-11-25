/**
 * POST /api/ai/ag-ui/deskbot — the deskbot surface for AG-UI clients.
 *
 * Accepts an AG-UI `RunAgentInput`, maps it onto the deskbot's own request
 * (`ag-ui/run-input.ts`), runs the SAME orchestrator turn `POST /api/ai/deskbot` runs, and
 * streams it back as AG-UI events (`ag-ui/serve-run.ts`) under the deny-by-default export
 * policy. Same door as the deskbot route: the session guard, the AI rate limit and daily
 * budget (`guardAiRequest`), the AI body cap, the hook's CSRF check (an AG-UI client sends
 * `X-Requested-With` as a configured header). See `docs/blueprint/ai/agent-user-interaction.md`.
 *
 * The deskbot first, alone: it is the surface whose loop has client actions (AG-UI's
 * frontend tools) and the approval boundary, the two semantics the protocol has to carry.
 * The chatbot's route does work at its boundary (page context, surface-action admission)
 * that would need its own mapping before it could take an AG-UI run.
 */
import { readAgUiRunInput } from '#lib/server/ai/ag-ui/run-input.ts';
import { serveAgUiRun } from '#lib/server/ai/ag-ui/serve-run.ts';
import { orchestrateChat } from '#lib/server/ai/chat-orchestrator.ts';
import { guardAiRequest } from '#lib/server/ai/guard.ts';
import { MAX_AI_BODY_BYTES, payloadTooLargeResponse, readJsonBounded } from '#lib/server/http/body.ts';
import { startDeadline } from '#lib/server/http/deadline.ts';
import { isAdmin } from '#lib/server/http/guards.ts';
import { apiError } from '#lib/server/http/response.ts';
import type { RequestHandler } from './$types';

// Node runtime + extended duration: the same streamed model turn as POST /api/ai/deskbot.
export const config = { runtime: 'nodejs22.x', maxDuration: 60 };

/** The turn's own budget under the function's ceiling — the deskbot route's, for the same turn. */
const TURN_BUDGET_MS = 55_000;

export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = await guardAiRequest(locals);
	if (guard.response) return guard.response;

	const read = await readJsonBounded(request, MAX_AI_BODY_BYTES);
	if (!read.ok) {
		if (read.reason === 'too_large') return payloadTooLargeResponse(MAX_AI_BODY_BYTES);
		return apiError(400, 'invalid_body', 'Request body must be valid JSON.');
	}

	const input = readAgUiRunInput(read.value, { userId: guard.user.id, surface: 'deskbot' });
	if (!input.ok) return apiError(input.refusal.status, input.refusal.code, input.refusal.message);
	const { request: desk } = input;

	const orchestrated = await orchestrateChat({
		userId: guard.user.id,
		registry: guard.registry,
		surface: 'deskbot',
		providerId: desk.providerId,
		messages: desk.messages as Parameters<typeof orchestrateChat>[0]['messages'],
		conversationId: desk.conversationId,
		signal: request.signal,
		deadline: startDeadline(TURN_BUDGET_MS),
		panelContext: desk.panelContext,
		// A consent preference, not a privilege boundary — see POST /api/ai/deskbot.
		toolScopes: desk.toolScopes,
		deskLayout: desk.deskLayout,
		// Derived from RunAgentInput.tools: the surface's client actions this client can run.
		clientActions: desk.clientActions,
		activeWorkspace: desk.activeWorkspace,
		locale: locals.locale,
		authCeiling: isAdmin(locals.user) ? 'admin' : locals.user ? 'user' : null,
	});

	return serveAgUiRun(orchestrated, { run: input.run, userId: guard.user.id, signal: request.signal });
};
