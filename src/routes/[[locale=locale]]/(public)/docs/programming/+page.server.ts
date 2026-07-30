import { getAgentRegistry } from '$lib/server/agents/registry';

const BUCKETS = [
	{ id: 'architecture-data', members: ['ary', 'sys', 'daty', 'apy'] },
	{ id: 'runtime-quality', members: ['tray', 'clyn', 'tesy'] },
	{ id: 'interface-words', members: ['svey', 'uxy', 'arty', 'laly', 'cony'] },
	{ id: 'intelligence-trust', members: ['aiy', 'secy', 'resy', 'scout', 'docy'] },
] as const;

export const load = () => {
	const registry = getAgentRegistry();
	const byId = new Map(registry.map((a) => [a.id, a]));
	const buckets = BUCKETS.map((b) => ({
		id: b.id,
		agents: b.members.flatMap((id) => {
			const a = byId.get(id);
			return a ? [{ id: a.id, color: a.color, soul: a.soul, role: a.role }] : [];
		}),
	}));
	return { title: 'Agents — Docs', buckets };
};
