/**
 * Shared entry guard for AI chat routes. Single-sources the auth → aiConfigured →
 * (rate-limit ∥ daily-budget) preamble so the per-surface routes (chatbot/deskbot/showcase)
 * stay thin and the rate-limit key can't drift across copies.
 *
 * Returns `{ user, registry }` on success — the provider snapshot loaded here is the one
 * the whole request resolves against — or an early `Response` (503 / 429 / budget
 * decision) the caller must return as-is.
 */
import { decisionResponse } from '$lib/server/abuse/decision.adapter';
import { loadProviderRegistry, type ProviderRegistry } from '$lib/server/ai';
import { checkUserBudget } from '$lib/server/ai/budget';
import { RATE_LIMIT_MAX, RATE_LIMIT_PREFIX, RATE_LIMIT_WINDOW } from '$lib/server/ai/config';
import { guardApiUser } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError } from '$lib/server/http/response';

const ratelimit = createLimiter(RATE_LIMIT_PREFIX, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);

type GuardResult =
	| { user: { id: string }; registry: ProviderRegistry; response?: never }
	| { user?: never; registry?: never; response: Response };

/** The three "no provider" states, told apart so an operator knows which one they are in. */
function unavailableMessage(registry: ProviderRegistry): string {
	return registry.degraded
		? 'The AI provider configuration needs an administrator’s attention.'
		: 'No AI provider is connected yet. An administrator can connect one in the admin area.';
}

export async function guardAiRequest(locals: App.Locals): Promise<GuardResult> {
	// Map guardApiUser's `{ error }` into this function's own `{ response }`
	// shape. The exported contract is unchanged, so the three callers are
	// untouched; only the status changes 500 → 401 for anonymous callers.
	const auth = guardApiUser(locals);
	if ('error' in auth) return { response: auth.error };
	const { user } = auth;

	let registry: ProviderRegistry;
	try {
		registry = await loadProviderRegistry();
	} catch {
		return { response: apiError(503, 'ai_unavailable', 'AI settings are unavailable right now.') };
	}

	const aiConfigured = registry.entries.some((p) => p.configured);
	if (!aiConfigured) {
		return { response: apiError(503, 'ai_unavailable', unavailableMessage(registry)) };
	}

	// The rate limiter and the per-user daily token budget (a cheap Redis read that rejects
	// once today's spend exceeds DAILY_TOKEN_CAP; the charge side runs in the orchestrator's
	// afterText) are two independent Redis round trips — issued together, read in precedence
	// order: when both deny, the rate-limit response answers.
	const [limit, budget] = await Promise.all([ratelimit.limit(user.id), checkUserBudget(user.id)]);
	if (!limit.success) return { response: rateLimitResponse(limit.reset) };
	if (!budget.allowed) return { response: decisionResponse(budget) };

	return { user, registry };
}
