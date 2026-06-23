/**
 * Shared entry guard for AI chat routes. Single-sources the auth → aiConfigured →
 * rate-limit → daily-budget preamble so the per-surface routes (chatbot/deskbot/showcase)
 * stay thin and the rate-limit key can't drift across copies.
 *
 * Returns `{ user }` on success, or an early `Response` (503 / 429 / budget decision)
 * the caller must return as-is.
 */
import { decisionResponse } from '$lib/server/abuse';
import { aiConfigured } from '$lib/server/ai';
import { checkUserBudget } from '$lib/server/ai/budget';
import { RATE_LIMIT_MAX, RATE_LIMIT_PREFIX, RATE_LIMIT_WINDOW } from '$lib/server/ai/config';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';

const ratelimit = createLimiter(RATE_LIMIT_PREFIX, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);

type GuardResult = { user: { id: string }; response?: never } | { user?: never; response: Response };

export async function guardAiRequest(locals: App.Locals): Promise<GuardResult> {
	const { user } = requireApiUser(locals);

	if (!aiConfigured) {
		return {
			response: apiError(503, 'ai_unavailable', 'No AI provider configured. Add an API key to your environment.'),
		};
	}

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return { response: rateLimitResponse(reset) };

	// Per-user daily token budget — a cheap Redis read at entry that rejects once today's
	// spend exceeds AI_DAILY_TOKEN_CAP. The charge side runs in the orchestrator's onFinish.
	const budget = await checkUserBudget(user.id);
	if (!budget.allowed) return { response: decisionResponse(budget) };

	return { user };
}
