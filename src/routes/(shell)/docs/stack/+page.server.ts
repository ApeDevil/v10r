import { type DocEntry, STACK_LAYER_ORDER } from '$lib/docs/types';
import { getManifest } from '$lib/server/docs/loader';

export const load = () => {
	const entries = getManifest().stack;
	const byLayer = new Map<string, DocEntry[]>();
	for (const e of entries) {
		const key = e.layer ?? 'other';
		if (!byLayer.has(key)) byLayer.set(key, []);
		byLayer.get(key)?.push(e);
	}
	const ordered = STACK_LAYER_ORDER.filter((l) => byLayer.has(l)).map((layer) => ({
		layer,
		items: byLayer.get(layer) ?? [],
	}));
	for (const [layer, items] of byLayer) {
		if (!STACK_LAYER_ORDER.includes(layer as (typeof STACK_LAYER_ORDER)[number])) {
			ordered.push({ layer: layer as (typeof STACK_LAYER_ORDER)[number], items });
		}
	}
	return { layers: ordered };
};
