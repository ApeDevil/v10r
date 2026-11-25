/**
 * The A2A Agent Card — `/.well-known/agent-card.json` (A2A 1.0 discovery). Describes the
 * architecture review agent served at `/api/a2a`. Static apart from the origin it advertises.
 */
import { buildArchitectureReviewCard } from '#lib/server/a2a/index.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) =>
	Response.json(buildArchitectureReviewCard(url.origin), {
		headers: { 'Cache-Control': 'public, max-age=3600' },
	});
