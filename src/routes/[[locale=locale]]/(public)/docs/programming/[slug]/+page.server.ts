import { error } from '@sveltejs/kit';
import { getAdjacentAgents, renderAgent } from '$lib/server/agents/render';

export const load = async ({ params }) => {
	const rendered = await renderAgent(params.slug);
	if (!rendered) throw error(404, 'Agent not found');
	const { prev, next } = getAdjacentAgents(params.slug);
	return {
		title: `${rendered.record.id} — Agents`,
		agent: {
			id: rendered.record.id,
			color: rendered.record.color,
			soul: rendered.record.soul,
			role: rendered.record.role,
		},
		html: rendered.html,
		prev: prev ? { id: prev.id } : null,
		next: next ? { id: next.id } : null,
	};
};
