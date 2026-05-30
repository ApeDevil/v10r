import { renderBlogPost } from '$lib/server/blog/pipeline';
import { type AgentRecord, getAgent, getAgentRegistry } from './registry';

export interface RenderedAgent {
	record: AgentRecord;
	html: string;
}

const cache = new Map<string, RenderedAgent>();

export async function renderAgent(id: string): Promise<RenderedAgent | null> {
	const hit = cache.get(id);
	if (hit) return hit;
	const record = getAgent(id);
	if (!record) return null;
	const result = await renderBlogPost(record.body);
	const rendered: RenderedAgent = { record, html: result.html };
	cache.set(id, rendered);
	return rendered;
}

export function getAdjacentAgents(id: string): { prev: AgentRecord | null; next: AgentRecord | null } {
	const list = getAgentRegistry();
	const idx = list.findIndex((a) => a.id === id);
	if (idx === -1) return { prev: null, next: null };
	return {
		prev: idx > 0 ? list[idx - 1] : null,
		next: idx < list.length - 1 ? list[idx + 1] : null,
	};
}
