import { building } from '$app/environment';
import { parseAgentId } from './parse';

const rawModules = import.meta.glob('/.claude/agents/*.md', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>;

/**
 * Every agent that must exist in `.claude/agents/`. Kept in sync in BOTH
 * directions by `getAgentIds()` — a missing file and an unlisted file are
 * equally drift. Adding an agent means adding it here in the same change.
 */
export const EXPECTED_AGENT_IDS = [
	'aiy',
	'apy',
	'arty',
	'ary',
	'clyn',
	'cony',
	'daty',
	'docy',
	'laly',
	'resy',
	'scout',
	'secy',
	'svey',
	'sys',
	'tesy',
	'tray',
	'uxy',
] as const;

let cached: string[] | null = null;

export function getAgentIds(): string[] {
	if (cached) return cached;

	const ids: string[] = [];
	for (const [absPath, raw] of Object.entries(rawModules)) {
		ids.push(parseAgentId(absPath, raw));
	}
	ids.sort();

	const present = new Set(ids);
	const expected = new Set<string>(EXPECTED_AGENT_IDS);
	const missing = EXPECTED_AGENT_IDS.filter((id) => !present.has(id));
	const extra = ids.filter((id) => !expected.has(id));
	if (missing.length > 0 || extra.length > 0) {
		const parts = [
			missing.length > 0 ? `listed but missing from .claude/agents/: ${missing.join(', ')}` : '',
			extra.length > 0 ? `present in .claude/agents/ but unlisted: ${extra.join(', ')}` : '',
		].filter(Boolean);
		throw new Error(`[agents] drift detected — ${parts.join('; ')}`);
	}

	cached = ids;
	return cached;
}

if (!building) {
	getAgentIds();
}
