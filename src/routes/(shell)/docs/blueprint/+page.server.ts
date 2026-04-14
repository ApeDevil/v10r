import { getManifest } from '$lib/server/docs/loader';
import type { DocEntry } from '$lib/docs/types';

export const load = () => {
	const entries = getManifest().blueprint;
	const groups = new Map<string, DocEntry[]>();
	for (const e of entries) {
		const key = e.group ?? 'general';
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key)?.push(e);
	}
	return {
		groups: Array.from(groups.entries()).map(([name, items]) => ({ name, items })),
	};
};
