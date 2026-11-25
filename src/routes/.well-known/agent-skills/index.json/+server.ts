/**
 * Agent Skills discovery index — `/.well-known/agent-skills/index.json` (schema 0.2.0).
 * `npx skills add https://<origin>` reads it, downloads each archive and verifies its digest.
 * Built from the registry once per process (`servedAgentSkillDiscovery`).
 */
import { servedAgentSkillDiscovery } from '#lib/server/patterns/index.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	Response.json(servedAgentSkillDiscovery().index, {
		headers: { 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' },
	});
