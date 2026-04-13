import { safeParse } from 'valibot';
import { aiConfigured } from '$lib/server/ai';
import { orchestrateChat } from '$lib/server/ai/chat-orchestrator';
import { RATE_LIMIT_MAX, RATE_LIMIT_PREFIX, RATE_LIMIT_WINDOW } from '$lib/server/ai/config';
import { ChatRequestSchema } from '$lib/server/ai/validation';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiValidationError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(RATE_LIMIT_PREFIX, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	if (!aiConfigured) {
		return apiError(503, 'ai_unavailable', 'No AI provider configured. Add an API key to your environment.');
	}

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = safeParse(ChatRequestSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	return orchestrateChat({
		userId: user.id,
		providerId: parsed.output.providerId,
		messages: parsed.output.messages as Parameters<typeof orchestrateChat>[0]['messages'],
		conversationId: parsed.output.conversationId,
		useRetrieval: parsed.output.useRetrieval,
		retrievalTiers: parsed.output.retrievalTiers,
		fusion: parsed.output.fusion,
		panelContext: parsed.output.panelContext,
		toolScopes: parsed.output.toolScopes,
		deskLayout: parsed.output.deskLayout,
		activeWorkspace: parsed.output.activeWorkspace,
	});
};
