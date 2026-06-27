/**
 * POST /api/ai/deskbot — the deskbot surface (in-desk operator: agentic, mutating,
 * plan-gated; UI-parity tools + desk:ask nRAG grounding). See `docs/blueprint/ai/surfaces.md`.
 */
import { safeParse } from 'valibot';
import { orchestrateChat } from '$lib/server/ai/chat-orchestrator';
import { guardAiRequest } from '$lib/server/ai/guard';
import { ChatRequestSchema } from '$lib/server/ai/validation';
import { apiError, apiValidationError } from '$lib/server/api/response';
import type { RequestHandler } from './$types';

// Node runtime + extended duration: an LLM stream routinely outlives the Vercel
// serverless default (~10-15s), which would silently truncate the answer mid-stream.
export const config = { runtime: 'nodejs22.x', maxDuration: 60 };

export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = await guardAiRequest(locals);
	if (guard.response) return guard.response;

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = safeParse(ChatRequestSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	return orchestrateChat({
		userId: guard.user.id,
		surface: 'deskbot',
		providerId: parsed.output.providerId,
		messages: parsed.output.messages as Parameters<typeof orchestrateChat>[0]['messages'],
		conversationId: parsed.output.conversationId,
		panelContext: parsed.output.panelContext,
		toolScopes: parsed.output.toolScopes,
		deskLayout: parsed.output.deskLayout,
		activeWorkspace: parsed.output.activeWorkspace,
		resumeFromProposalId: parsed.output.resumeFromProposalId,
		locale: locals.locale,
		authCeiling: locals.user?.role ?? null,
	});
};
