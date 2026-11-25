/**
 * One agent skill archive — `/.well-known/agent-skills/<name>.tar.gz`, as listed in the
 * discovery index. Unknown names are 404; nothing outside the generated set is reachable.
 */
import { error } from '@sveltejs/kit';
import { servedAgentSkillDiscovery } from '#lib/server/patterns/index.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const bytes = servedAgentSkillDiscovery().archives.get(params.archive);
	if (!bytes) error(404, 'No such agent skill archive');
	return new Response(bytes, {
		headers: {
			'Content-Type': 'application/gzip',
			'Cache-Control': 'public, max-age=3600',
			'Access-Control-Allow-Origin': '*',
		},
	});
};
