import { parseAgentId } from './parse';

const rawModules = import.meta.glob('/.claude/agents/*.md', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>;

const COLOR_LINE = /^color:\s*([a-z]+)\s*$/m;
const ROLE_LINE = /^-\s*Role:\s*(.+?)\s*$/m;
const SOUL_LINE = /You are [A-Z0-9-]+ with a soul:\s*"([^"]+)"/;

export interface AgentRecord {
	id: string;
	color: string | null;
	role: string | null;
	soul: string | null;
	body: string;
}

let cached: AgentRecord[] | null = null;

function splitFrontmatterAndBody(raw: string): { fm: string; body: string } {
	if (!raw.startsWith('---\n')) {
		return { fm: '', body: raw };
	}
	const end = raw.indexOf('\n---', 4);
	if (end === -1) return { fm: '', body: raw };
	return { fm: raw.slice(4, end), body: raw.slice(end + 4).replace(/^\n/, '') };
}

function buildRecord(absPath: string, raw: string): AgentRecord {
	const id = parseAgentId(absPath, raw);
	const { fm, body } = splitFrontmatterAndBody(raw);
	const color = fm.match(COLOR_LINE)?.[1] ?? null;
	const role = body.match(ROLE_LINE)?.[1] ?? null;
	const soul = body.match(SOUL_LINE)?.[1] ?? null;
	return { id, color, role, soul, body };
}

export function getAgentRegistry(): AgentRecord[] {
	if (cached) return cached;
	const records: AgentRecord[] = [];
	for (const [absPath, raw] of Object.entries(rawModules)) {
		records.push(buildRecord(absPath, raw));
	}
	records.sort((a, b) => a.id.localeCompare(b.id));
	cached = records;
	return cached;
}

export function getAgent(id: string): AgentRecord | null {
	return getAgentRegistry().find((a) => a.id === id) ?? null;
}
