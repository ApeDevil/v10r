import { building } from '$app/environment';
import { parseAgentId } from './parse';

const rawModules = import.meta.glob('/.claude/agents/*.md', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>;

export const EXPECTED_AGENT_IDS = ['arty', 'daty', 'docy', 'resy', 'scout', 'secy', 'svey', 'tray', 'uxy'] as const;

let cached: string[] | null = null;

export function getAgentIds(): string[] {
	if (cached) return cached;

	const ids: string[] = [];
	for (const [absPath, raw] of Object.entries(rawModules)) {
		ids.push(parseAgentId(absPath, raw));
	}
	ids.sort();

	const present = new Set(ids);
	const missing = EXPECTED_AGENT_IDS.filter((id) => !present.has(id));
	if (missing.length > 0) {
		throw new Error(
			`[agents] drift detected — structure-map references agents that are missing from .claude/agents/: ${missing.join(', ')}`,
		);
	}

	cached = ids;
	return cached;
}

if (!building) {
	getAgentIds();
}
