/**
 * POST /api/ai/deskbot — the deskbot surface (in-desk operator: agentic, mutating,
 * plan-gated; UI-parity tools + desk:ask nRAG grounding). See `docs/blueprint/ai/surfaces.md`.
 */
import { safeParse } from 'valibot';
import { orchestrateChat } from '$lib/server/ai/chat-orchestrator';
import { guardAiRequest } from '$lib/server/ai/guard';
import { DeskRequestSchema } from '$lib/server/ai/validation';
import { apiError, apiValidationError } from '$lib/server/api/response';
import { isAdmin } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

// Node runtime + extended duration: an LLM stream routinely outlives the Vercel
// serverless default (~10-15s), which would silently truncate the answer mid-stream.
export const config = { runtime: 'nodejs22.x', maxDuration: 60 };

export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = await guardAiRequest(locals);
	if (guard.response) return guard.response;

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = safeParse(DeskRequestSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	return orchestrateChat({
		userId: guard.user.id,
		surface: 'deskbot',
		providerId: parsed.output.providerId,
		messages: parsed.output.messages as Parameters<typeof orchestrateChat>[0]['messages'],
		conversationId: parsed.output.conversationId,
		panelContext: parsed.output.panelContext,
		/**
		 * Client-declared, and deliberately so — but be clear about what it is.
		 *
		 * These are a CONSENT preference (which capabilities the user switched on
		 * in the UI), not a privilege boundary. Valibot pins the values to the
		 * known scope enum, and every desk mutation is `userId`-scoped underneath,
		 * so the worst a caller can do by asserting extra scopes is act on their
		 * OWN data without having ticked the box — never on anyone else's.
		 *
		 * Making it a real boundary would need a server-side per-user desk
		 * permission record to intersect against; there is no such store today, so
		 * intersecting with "everything an authenticated user may do" would be a
		 * no-op dressed up as a check. The place it genuinely matters — approval
		 * replay — is closed instead: proposals freeze their grant at creation
		 * (`grantedScopes`) and `executeDeskToolCall` enforces it.
		 */
		toolScopes: parsed.output.toolScopes,
		deskLayout: parsed.output.deskLayout,
		activeWorkspace: parsed.output.activeWorkspace,
		resumeFromProposalId: parsed.output.resumeFromProposalId,
		locale: locals.locale,
		// Derived from the env admin list, never a DB column — `user.role` used to
		// feed this, which quietly made catalog visibility a second privilege plane.
		authCeiling: isAdmin(locals.user) ? 'admin' : locals.user ? 'user' : null,
	});
};
