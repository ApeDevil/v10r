/**
 * GET /api/ai/profiles/[surface] — the assistant profile of one surface, for a signed-in
 * viewer: identity text, every capability with its guidance and its tools as the model
 * receives them (description + JSON schema), and what each grounding source holds for the
 * viewer (`$lib/types/assistant-profile.ts`).
 *
 * The "available" side of a turn, read from the profile rather than reconstructed from a
 * second run. Signed-in only (decision D7): the desk inventory is the viewer's
 * own, and the guidance text is the pattern library's subject, not a secret. Provider
 * keys and internals never enter a profile.
 */
import {
	CONVERSATION_RATE_LIMIT_MAX,
	CONVERSATION_RATE_LIMIT_PREFIX,
	CONVERSATION_RATE_LIMIT_WINDOW,
} from '$lib/server/ai/config';
import { PROFILES } from '$lib/server/ai/profile';
import { profileManifest } from '$lib/server/ai/profile/manifest';
import { classifyDbError, safeDbMessage } from '$lib/server/db/errors';
import { guardApiUser, isAdmin } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiOk } from '$lib/server/http/response';
import type { AiSurface } from '$lib/types/db-enums';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(
	CONVERSATION_RATE_LIMIT_PREFIX,
	CONVERSATION_RATE_LIMIT_MAX,
	CONVERSATION_RATE_LIMIT_WINDOW,
);

const isSurface = (value: string): value is AiSurface => value in PROFILES;

export const GET: RequestHandler = async ({ params, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	if (!isSurface(params.surface)) return apiError(404, 'not_found', 'Unknown assistant surface.');

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		const manifest = await profileManifest(PROFILES[params.surface], {
			userId: user.id,
			locale: locals.locale ?? 'en',
			// The chatbot route's own ceiling rule: the env admin list, never a DB role.
			authCeiling: isAdmin(locals.user) ? 'admin' : 'user',
		});
		return apiOk(manifest);
	} catch (err) {
		const dbErr = classifyDbError(err);
		return apiError(dbErr.toStatus(), dbErr.kind, safeDbMessage(dbErr.kind));
	}
};
