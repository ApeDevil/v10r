/**
 * POST /api/ai/showcase/rag — the retrieval-pipeline showcase demo (NOT a product
 * surface). Drives the rag-chat showcase + trace drawer, which TOGGLE between the
 * llmwiki-grounded path and the raw 3-tier retrieval path — so this route passes both
 * flags through and lets the orchestrator derive the surface (it is never a product
 * `chatbot`/`deskbot` entry edge). See `docs/blueprint/ai/surfaces.md`.
 */
import { safeParse } from 'valibot';
import { orchestrateChat } from '$lib/server/ai/chat-orchestrator';
import { guardAiRequest } from '$lib/server/ai/guard';
import { RagDemoRequestSchema } from '$lib/server/ai/validation';
import { MAX_AI_BODY_BYTES, payloadTooLargeResponse, readJsonBounded } from '$lib/server/api/body';
import { apiError, apiValidationError } from '$lib/server/api/response';
import { isAdmin } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

// Node runtime + extended duration: an LLM stream routinely outlives the Vercel
// serverless default (~10-15s), which would silently truncate the answer mid-stream.
export const config = { runtime: 'nodejs22.x', maxDuration: 60 };

export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = await guardAiRequest(locals);
	if (guard.response) return guard.response;

	const read = await readJsonBounded(request, MAX_AI_BODY_BYTES);
	if (!read.ok) {
		if (read.reason === 'too_large') return payloadTooLargeResponse(MAX_AI_BODY_BYTES);
		return apiError(400, 'invalid_body', 'Request body must be valid JSON.');
	}
	const body = read.value;

	const parsed = safeParse(RagDemoRequestSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	// Surface derived from the flags (useLlmwiki → chatbot path; else rag-demo) — this is a
	// teaching surface that demonstrates both, never a fixed product surface.
	return orchestrateChat({
		userId: guard.user.id,
		providerId: parsed.output.providerId,
		messages: parsed.output.messages as Parameters<typeof orchestrateChat>[0]['messages'],
		conversationId: parsed.output.conversationId,
		useRetrieval: parsed.output.useRetrieval,
		retrievalTiers: parsed.output.retrievalTiers,
		fusion: parsed.output.fusion,
		useLlmwiki: parsed.output.useLlmwiki,
		llmwikiCollectionId: parsed.output.llmwikiCollectionId,
		locale: locals.locale,
		// Derived from the env admin list, never a DB column — `user.role` used to
		// feed this, which quietly made catalog visibility a second privilege plane.
		authCeiling: isAdmin(locals.user) ? 'admin' : locals.user ? 'user' : null,
		dryRun: parsed.output.dryRun,
	});
};
