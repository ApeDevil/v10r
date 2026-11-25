/**
 * POST /api/ai/chatbot — the chatbot surface (v10r expert: read-only, grounded Q&A).
 * See `docs/blueprint/ai/surfaces.md`.
 */
import { safeParse } from 'valibot';
import type { Locale } from '#lib/i18n/index.ts';
import { orchestrateChat } from '#lib/server/ai/chat-orchestrator.ts';
import {
	admitConversationSurfaceAction,
	type SurfaceActionTurn,
	surfaceActionPromptsForModel,
} from '#lib/server/ai/generative-ui/index.ts';
import { guardAiRequest } from '#lib/server/ai/guard.ts';
import { ChatbotRequestSchema } from '#lib/server/ai/validation.ts';
import { MAX_AI_BODY_BYTES, payloadTooLargeResponse, readJsonBounded } from '#lib/server/http/body.ts';
import { startDeadline } from '#lib/server/http/deadline.ts';
import { isAdmin } from '#lib/server/http/guards.ts';
import { apiError, apiValidationError } from '#lib/server/http/response.ts';
import { resolvePageContext } from '#lib/server/search/index.ts';
import type { RequestHandler } from './$types';

// Node runtime + extended duration: an LLM stream routinely outlives the Vercel
// serverless default (~10-15s), which would silently truncate the answer mid-stream.
export const config = { runtime: 'nodejs22.x', maxDuration: 60 };

/**
 * The turn's own budget, under the function's ceiling above: every model call is bounded by
 * what is left of it (minus the orchestrator's finalization reserve), so a late step is cut
 * with time to persist the answer rather than by the platform with none. The hook's default
 * request deadline (10 s) is for ordinary routes, not a streamed model turn.
 */
const TURN_BUDGET_MS = 55_000;

export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = await guardAiRequest(locals);
	if (guard.response) return guard.response;

	const read = await readJsonBounded(request, MAX_AI_BODY_BYTES);
	if (!read.ok) {
		if (read.reason === 'too_large') return payloadTooLargeResponse(MAX_AI_BODY_BYTES);
		return apiError(400, 'invalid_body', 'Request body must be valid JSON.');
	}
	const body = read.value;

	const parsed = safeParse(ChatbotRequestSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	// Site-awareness: resolve the client route id to trusted catalog metadata HERE, at the
	// trust boundary (the raw id never reaches the orchestrator). Miss/dynamic/private → null.
	const pageContext = resolvePageContext(parsed.output.pageRouteId, (locals.locale ?? 'en') as Locale);

	// A Button press on a generative surface: admitted against the persisted conversation (the
	// caller's own, the surface's current version, a Button that declares this event, a press
	// and a submission not already admitted). The turn's parts become the door's own record —
	// what the user row stores and the bubble shows — and every recorded press in the thread
	// reaches the model as the door's untrusted-content prompt. Never an approval of anything.
	let messages = parsed.output.messages;
	let surfaceActionTurn: SurfaceActionTurn | undefined;
	const surfaceAction = parsed.output.surfaceAction;
	if (surfaceAction) {
		const last = messages.at(-1);
		if (!parsed.output.conversationId || last?.role !== 'user')
			return apiError(409, 'surface_action_rejected', 'A surface action needs its conversation.');
		const admission = await admitConversationSurfaceAction(parsed.output.conversationId, guard.user.id, surfaceAction);
		if (!admission.ok) return apiError(409, 'surface_action_rejected', admission.reason);
		surfaceActionTurn = admission.turn;
		messages = [...messages.slice(0, -1), { ...last, parts: admission.turn.parts }];
	}

	return orchestrateChat({
		userId: guard.user.id,
		registry: guard.registry,
		surface: 'chatbot',
		providerId: parsed.output.providerId,
		messages: surfaceActionPromptsForModel(messages) as Parameters<typeof orchestrateChat>[0]['messages'],
		userRow: surfaceActionTurn && {
			id: surfaceActionTurn.messageId,
			content: surfaceActionTurn.content,
			parts: surfaceActionTurn.parts,
		},
		conversationId: parsed.output.conversationId,
		signal: request.signal,
		deadline: startDeadline(TURN_BUDGET_MS),
		pageContext,
		// Server-derived, never client-trusted: catalog tool needs request locale + auth ceiling.
		locale: locals.locale,
		// Derived from the env admin list, never a DB column — `user.role` used to
		// feed this, which quietly made catalog visibility a second privilege plane.
		authCeiling: isAdmin(locals.user) ? 'admin' : locals.user ? 'user' : null,
	});
};
