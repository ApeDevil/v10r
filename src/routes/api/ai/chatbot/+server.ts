/**
 * POST /api/ai/chatbot — the chatbot surface (v10r expert: read-only, grounded Q&A).
 * See `docs/blueprint/ai/surfaces.md`.
 */
import { safeParse } from 'valibot';
import type { SearchLocale } from '$lib/search/types';
import { orchestrateChat } from '$lib/server/ai/chat-orchestrator';
import { guardAiRequest } from '$lib/server/ai/guard';
import { ChatRequestSchema } from '$lib/server/ai/validation';
import { apiError, apiValidationError } from '$lib/server/api/response';
import { resolvePageContext } from '$lib/server/search';
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

	// Site-awareness: resolve the client route id to trusted catalog metadata HERE, at the
	// trust boundary (the raw id never reaches the orchestrator). Miss/dynamic/private → null.
	const pageContext = resolvePageContext(parsed.output.pageRouteId, (locals.locale ?? 'en') as SearchLocale);

	return orchestrateChat({
		userId: guard.user.id,
		surface: 'chatbot',
		providerId: parsed.output.providerId,
		messages: parsed.output.messages as Parameters<typeof orchestrateChat>[0]['messages'],
		conversationId: parsed.output.conversationId,
		useLlmwiki: parsed.output.useLlmwiki,
		llmwikiCollectionId: parsed.output.llmwikiCollectionId,
		resumeFromProposalId: parsed.output.resumeFromProposalId,
		pageContext,
		// Server-derived, never client-trusted: catalog tool needs request locale + auth ceiling.
		locale: locals.locale,
		authCeiling: locals.user?.role ?? null,
	});
};
